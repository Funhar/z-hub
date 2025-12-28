Documentation for AccessControl

{% hint style="info" %}
To run this example correctly, make sure the files are placed in the following directories:

- `.sol` file → `<your-project-root-dir>/contracts/`
- `.ts` file → `<your-project-root-dir>/test/`

This ensures Hardhat can compile and test your contracts as expected.
{% endhint %}

{% tabs %}

{% tab title="AccessControl.sol" %}

```solidity
// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import { FHE, euint8, externalEuint8 } from "@fhevm/solidity/lib/FHE.sol";
import { ZamaEthereumConfig } from "@fhevm/solidity/config/ZamaConfig.sol";

/**
 * @title AccessControl
 * @notice Demonstrates FHE access control mechanisms: allow and allowTransient.
 * @dev This example shows the difference between:
 *      - FHE.allow(): Grants permanent permission to an address
 *      - FHE.allowTransient(): Grants ephemeral permission for the current tx only
 *      - FHE.allowThis(): Shortcut for allowing the contract itself
 */
contract AccessControl is ZamaEthereumConfig {
  euint8 private _secretValue;

  // Mapping to track who has been granted permanent access
  mapping(address => bool) public hasPermanentAccess;

  event PermanentAccessGranted(address indexed user);
  event TransientAccessGranted(address indexed user);

  // solhint-disable-next-line no-empty-blocks
  constructor() {}

  /**
   * @notice Store an encrypted value with contract-only access.
   * @dev Only FHE.allowThis() is called, so only the contract can operate on it.
   */
  function storeSecret(externalEuint8 input, bytes calldata inputProof) external {
    _secretValue = FHE.fromExternal(input, inputProof);
    // Only the contract itself can access this value
    FHE.allowThis(_secretValue);
  }

  /**
   * @notice Grant permanent FHE permission to a user.
   * @dev FHE.allow() grants persistent permission that survives across transactions.
   *      The user can decrypt the value at any time after this call.
   */
  function grantPermanentAccess(address user) external {
    // Grant permanent access to the user
    FHE.allow(_secretValue, user);
    hasPermanentAccess[user] = true;
    emit PermanentAccessGranted(user);
  }

  /**
   * @notice Grant temporary FHE permission for this transaction only.
   * @dev FHE.allowTransient() grants ephemeral permission that is revoked when tx ends.
   *      Useful for intermediate computations where values shouldn't persist.
   */
  function grantTransientAccess(address user) external {
    // Grant transient access - permission expires when transaction ends
    FHE.allowTransient(_secretValue, user);
    emit TransientAccessGranted(user);
  }

  /**
   * @notice Get the secret value handle (for decryption by authorized users).
   */
  function getSecret() public view returns (euint8) {
    return _secretValue;
  }

  /**
   * @notice Demonstrates chained operations with allowThis.
   * @dev After any FHE operation, the result only has transient permission.
   *      You must call FHE.allowThis() to persist the contract's access.
   */
  function doubleSecret() external {
    // Add the secret to itself
    euint8 doubled = FHE.add(_secretValue, _secretValue);

    // Without this, the contract loses access after the tx ends
    FHE.allowThis(doubled);

    // Update the stored value
    _secretValue = doubled;
  }
}

```

{% endtab %}

{% tab title="AccessControl.ts" %}

```typescript
import {
  FhevmType,
  HardhatFhevmRuntimeEnvironment,
} from "@fhevm/hardhat-plugin";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers } from "hardhat";
import * as hre from "hardhat";

import { AccessControl, AccessControl__factory } from "../../../types";
import type { Signers } from "../../types";

async function deployFixture() {
  const factory = (await ethers.getContractFactory(
    "AccessControl"
  )) as AccessControl__factory;
  const accessControl = (await factory.deploy()) as AccessControl;
  const accessControl_address = await accessControl.getAddress();

  return { accessControl, accessControl_address };
}

/**
 * This example demonstrates FHE access control mechanisms.
 * Tests verify the behavior of allow, allowTransient, and allowThis.
 */
describe("AccessControl", function () {
  let contract: AccessControl;
  let contractAddress: string;
  let signers: Signers;
  let bob: HardhatEthersSigner;

  before(async function () {
    if (!hre.fhevm.isMock) {
      throw new Error(`This hardhat test suite cannot run on Sepolia Testnet`);
    }

    const ethSigners: HardhatEthersSigner[] = await ethers.getSigners();
    signers = { owner: ethSigners[0], alice: ethSigners[1] };
    bob = ethSigners[2];
  });

  beforeEach(async function () {
    const deployment = await deployFixture();
    contractAddress = deployment.accessControl_address;
    contract = deployment.accessControl;
  });

  it("should allow permanent access with FHE.allow()", async function () {
    const fhevm: HardhatFhevmRuntimeEnvironment = hre.fhevm;
    const secretValue = 42;

    // Alice stores a secret
    const input = await fhevm
      .createEncryptedInput(contractAddress, signers.alice.address)
      .add8(secretValue)
      .encrypt();
    let tx = await contract
      .connect(signers.alice)
      .storeSecret(input.handles[0], input.inputProof);
    await tx.wait();

    // Grant permanent access to Bob
    tx = await contract
      .connect(signers.alice)
      .grantPermanentAccess(bob.address);
    await tx.wait();

    // Bob should be able to decrypt the value
    const encryptedSecret = await contract.getSecret();
    const decryptedValue = await fhevm.userDecryptEuint(
      FhevmType.euint8,
      encryptedSecret,
      contractAddress,
      bob
    );

    expect(decryptedValue).to.equal(secretValue);
    expect(await contract.hasPermanentAccess(bob.address)).to.equal(true);
  });

  it("should emit event when granting transient access", async function () {
    const fhevm: HardhatFhevmRuntimeEnvironment = hre.fhevm;
    const secretValue = 100;

    // Alice stores a secret
    const input = await fhevm
      .createEncryptedInput(contractAddress, signers.alice.address)
      .add8(secretValue)
      .encrypt();
    let tx = await contract
      .connect(signers.alice)
      .storeSecret(input.handles[0], input.inputProof);
    await tx.wait();

    // Grant transient access and check event
    await expect(
      contract.connect(signers.alice).grantTransientAccess(bob.address)
    )
      .to.emit(contract, "TransientAccessGranted")
      .withArgs(bob.address);
  });

  it("should allow contract to double its secret value", async function () {
    const fhevm: HardhatFhevmRuntimeEnvironment = hre.fhevm;
    const secretValue = 50;

    // Alice stores a secret
    const input = await fhevm
      .createEncryptedInput(contractAddress, signers.alice.address)
      .add8(secretValue)
      .encrypt();
    let tx = await contract
      .connect(signers.alice)
      .storeSecret(input.handles[0], input.inputProof);
    await tx.wait();

    // Double the secret
    tx = await contract.connect(signers.alice).doubleSecret();
    await tx.wait();

    // Grant access to Alice to verify
    tx = await contract
      .connect(signers.alice)
      .grantPermanentAccess(signers.alice.address);
    await tx.wait();

    // Verify the value is doubled
    const encryptedSecret = await contract.getSecret();
    const decryptedValue = await fhevm.userDecryptEuint(
      FhevmType.euint8,
      encryptedSecret,
      contractAddress,
      signers.alice
    );

    expect(decryptedValue).to.equal(secretValue * 2);
  });
});

```

{% endtab %}

{% endtabs %}
