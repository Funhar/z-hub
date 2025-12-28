Documentation for HandleLifecycle

{% hint style="info" %}
To run this example correctly, make sure the files are placed in the following directories:

- `.sol` file → `<your-project-root-dir>/contracts/`
- `.ts` file → `<your-project-root-dir>/test/`

This ensures Hardhat can compile and test your contracts as expected.
{% endhint %}

{% tabs %}

{% tab title="HandleLifecycle.sol" %}

```solidity
// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import { FHE, euint8, euint16, externalEuint8 } from "@fhevm/solidity/lib/FHE.sol";
import { ZamaEthereumConfig } from "@fhevm/solidity/config/ZamaConfig.sol";

/**
 * @title HandleLifecycle
 * @notice Demonstrates the lifecycle of FHE handles in FHEVM.
 * @dev Handles are unique identifiers for encrypted values. Understanding
 *      their lifecycle is crucial for proper FHEVM development:
 *
 *      1. CREATION: Handles are created when:
 *         - User submits encrypted input (externalEuint -> euint)
 *         - FHE operations produce new encrypted values
 *         - FHE.asEuintXX() trivial encryption
 *
 *      2. PERMISSIONS: Each handle has associated permissions:
 *         - Ephemeral: Temporary within transaction
 *         - Persistent: Stored and survives across transactions
 *
 *      3. SYMBOLIC EXECUTION: The blockchain doesn't see actual values,
 *         only operates on handles. Real computation happens off-chain.
 */
contract HandleLifecycle is ZamaEthereumConfig {
  // Different handle types for demonstration
  euint8 private _handle8;
  euint16 private _handle16;
  euint8 private _derivedHandle;

  // Track handle creation for educational purposes
  uint256 public handleCreationCount;

  event HandleCreated(string message);
  event HandleDerived(string operation);

  // solhint-disable-next-line no-empty-blocks
  constructor() {}

  /**
   * @notice Create a handle from user input (external handle).
   * @dev This is the most common way to create handles.
   *      The external handle from client-side encryption is converted
   *      to an internal handle that the contract can work with.
   */
  function createFromInput(externalEuint8 input, bytes calldata inputProof) external {
    _handle8 = FHE.fromExternal(input, inputProof);
    FHE.allowThis(_handle8);
    FHE.allow(_handle8, msg.sender);

    handleCreationCount++;
    emit HandleCreated("Handle created from user input");
  }

  /**
   * @notice Create a handle through trivial encryption.
   * @dev FHE.asEuintXX() encrypts a plaintext value on-chain.
   *      Note: This reveals the value publicly on-chain, so only use
   *      for public constants that need to interact with encrypted values.
   */
  function createFromTrivialEncryption(uint8 publicValue) external {
    // Trivial encryption - value is public but can interact with encrypted values
    _handle8 = FHE.asEuint8(publicValue);
    FHE.allowThis(_handle8);

    handleCreationCount++;
    emit HandleCreated("Handle created via trivial encryption");
  }

  /**
   * @notice Derive a new handle from existing handles.
   * @dev Any FHE operation creates a new derived handle.
   *      The derived handle initially has ephemeral permission only.
   */
  function deriveNewHandle() external {
    // Each operation creates a new handle
    _derivedHandle = FHE.add(_handle8, FHE.asEuint8(1));

    // Derived handles need explicit permission grants
    FHE.allowThis(_derivedHandle);
    FHE.allow(_derivedHandle, msg.sender);

    handleCreationCount++;
    emit HandleDerived("add");
  }

  /**
   * @notice Cast handle to different type (euint8 -> euint16).
   * @dev Type casting creates a new handle of the target type.
   */
  function castHandle() external {
    // Casting creates a new handle of different type
    _handle16 = FHE.asEuint16(_handle8);
    FHE.allowThis(_handle16);
    FHE.allow(_handle16, msg.sender);

    handleCreationCount++;
    emit HandleDerived("cast to euint16");
  }

  function getHandle8() public view returns (euint8) {
    return _handle8;
  }

  function getHandle16() public view returns (euint16) {
    return _handle16;
  }

  function getDerivedHandle() public view returns (euint8) {
    return _derivedHandle;
  }
}

```

{% endtab %}

{% tab title="HandleLifecycle.ts" %}

```typescript
import {
  FhevmType,
  HardhatFhevmRuntimeEnvironment,
} from "@fhevm/hardhat-plugin";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers } from "hardhat";
import * as hre from "hardhat";

import { HandleLifecycle, HandleLifecycle__factory } from "../../../types";
import type { Signers } from "../../types";

async function deployFixture() {
  const factory = (await ethers.getContractFactory(
    "HandleLifecycle"
  )) as HandleLifecycle__factory;
  const handleLifecycle = (await factory.deploy()) as HandleLifecycle;
  const handleLifecycle_address = await handleLifecycle.getAddress();

  return { handleLifecycle, handleLifecycle_address };
}

/**
 * This example demonstrates the lifecycle of FHE handles.
 * Tests verify handle creation, derivation, and type casting.
 */
describe("HandleLifecycle", function () {
  let contract: HandleLifecycle;
  let contractAddress: string;
  let signers: Signers;

  before(async function () {
    if (!hre.fhevm.isMock) {
      throw new Error(`This hardhat test suite cannot run on Sepolia Testnet`);
    }

    const ethSigners: HardhatEthersSigner[] = await ethers.getSigners();
    signers = { owner: ethSigners[0], alice: ethSigners[1] };
  });

  beforeEach(async function () {
    const deployment = await deployFixture();
    contractAddress = deployment.handleLifecycle_address;
    contract = deployment.handleLifecycle;
  });

  it("should create handle from user input", async function () {
    const fhevm: HardhatFhevmRuntimeEnvironment = hre.fhevm;
    const value = 42;

    const input = await fhevm
      .createEncryptedInput(contractAddress, signers.alice.address)
      .add8(value)
      .encrypt();

    await expect(
      contract
        .connect(signers.alice)
        .createFromInput(input.handles[0], input.inputProof)
    )
      .to.emit(contract, "HandleCreated")
      .withArgs("Handle created from user input");

    expect(await contract.handleCreationCount()).to.equal(1);

    // Verify the value
    const encrypted = await contract.getHandle8();
    const decrypted = await fhevm.userDecryptEuint(
      FhevmType.euint8,
      encrypted,
      contractAddress,
      signers.alice
    );
    expect(decrypted).to.equal(value);
  });

  it("should create handle via trivial encryption", async function () {
    const publicValue = 100;

    await expect(
      contract.connect(signers.alice).createFromTrivialEncryption(publicValue)
    )
      .to.emit(contract, "HandleCreated")
      .withArgs("Handle created via trivial encryption");

    expect(await contract.handleCreationCount()).to.equal(1);
  });

  it("should derive new handle from operations", async function () {
    const fhevm: HardhatFhevmRuntimeEnvironment = hre.fhevm;
    const initialValue = 50;

    // First create a handle
    const input = await fhevm
      .createEncryptedInput(contractAddress, signers.alice.address)
      .add8(initialValue)
      .encrypt();
    let tx = await contract
      .connect(signers.alice)
      .createFromInput(input.handles[0], input.inputProof);
    await tx.wait();

    // Derive a new handle
    await expect(contract.connect(signers.alice).deriveNewHandle())
      .to.emit(contract, "HandleDerived")
      .withArgs("add");

    // Count should be 2 (original + derived)
    expect(await contract.handleCreationCount()).to.equal(2);

    // Derived handle should be original + 1
    const encrypted = await contract.getDerivedHandle();
    const decrypted = await fhevm.userDecryptEuint(
      FhevmType.euint8,
      encrypted,
      contractAddress,
      signers.alice
    );
    expect(decrypted).to.equal(initialValue + 1);
  });

  it("should cast handle to different type", async function () {
    const fhevm: HardhatFhevmRuntimeEnvironment = hre.fhevm;
    const value = 200;

    // Create euint8 handle
    const input = await fhevm
      .createEncryptedInput(contractAddress, signers.alice.address)
      .add8(value)
      .encrypt();
    let tx = await contract
      .connect(signers.alice)
      .createFromInput(input.handles[0], input.inputProof);
    await tx.wait();

    // Cast to euint16
    await expect(contract.connect(signers.alice).castHandle())
      .to.emit(contract, "HandleDerived")
      .withArgs("cast to euint16");

    // Verify cast value
    const encrypted16 = await contract.getHandle16();
    const decrypted16 = await fhevm.userDecryptEuint(
      FhevmType.euint16,
      encrypted16,
      contractAddress,
      signers.alice
    );
    expect(decrypted16).to.equal(value);
  });
});

```

{% endtab %}

{% endtabs %}
