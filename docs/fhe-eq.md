Master FHE.eq() to compare encrypted values without revealing contents.

{% hint style="info" %}
To run this example correctly, make sure the files are placed in the following directories:

- `.sol` file → `<your-project-root-dir>/contracts/`
- `.ts` file → `<your-project-root-dir>/test/`

This ensures Hardhat can compile and test your contracts as expected.
{% endhint %}

{% tabs %}

{% tab title="FHEEq.sol" %}

```solidity
// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import { FHE, euint8, ebool, externalEuint8 } from "@fhevm/solidity/lib/FHE.sol";
import { ZamaEthereumConfig } from "@fhevm/solidity/config/ZamaConfig.sol";

/**
 * @title FHEEq
 * @notice Demonstrates FHE equality comparison on encrypted values.
 * @dev This example shows how to compare two encrypted values using FHE.eq()
 *      which returns an encrypted boolean (ebool).
 */
contract FHEEq is ZamaEthereumConfig {
  euint8 private _a;
  euint8 private _b;
  // solhint-disable-next-line var-name-mixedcase
  ebool private _a_equals_b;

  // solhint-disable-next-line no-empty-blocks
  constructor() {}

  function setA(externalEuint8 inputA, bytes calldata inputProof) external {
    _a = FHE.fromExternal(inputA, inputProof);
    FHE.allowThis(_a);
  }

  function setB(externalEuint8 inputB, bytes calldata inputProof) external {
    _b = FHE.fromExternal(inputB, inputProof);
    FHE.allowThis(_b);
  }

  /**
   * @notice Compares two encrypted values for equality.
   * @dev FHE.eq() returns an encrypted boolean (ebool).
   *      The result reveals nothing about the comparison until decrypted.
   */
  function compareAEqualsB() external {
    // FHE equality comparison returns an encrypted boolean
    _a_equals_b = FHE.eq(_a, _b);

    // Grant permissions for the result
    FHE.allowThis(_a_equals_b);
    FHE.allow(_a_equals_b, msg.sender);
  }

  function result() public view returns (ebool) {
    return _a_equals_b;
  }
}

```

{% endtab %}

{% tab title="FHEEq.ts" %}

```typescript
import {
  FhevmType,
  HardhatFhevmRuntimeEnvironment,
} from "@fhevm/hardhat-plugin";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers } from "hardhat";
import * as hre from "hardhat";

import { FHEEq, FHEEq__factory } from "../../../types";
import type { Signers } from "../../types";

async function deployFixture() {
  const factory = (await ethers.getContractFactory("FHEEq")) as FHEEq__factory;
  const fheEq = (await factory.deploy()) as FHEEq;
  const fheEq_address = await fheEq.getAddress();

  return { fheEq, fheEq_address };
}

/**
 * This example demonstrates FHE equality comparison.
 * Tests verify that FHE.eq() correctly compares encrypted values.
 */
describe("FHEEq", function () {
  let contract: FHEEq;
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
    contractAddress = deployment.fheEq_address;
    contract = deployment.fheEq;
  });

  it("should return true when a equals b", async function () {
    const fhevm: HardhatFhevmRuntimeEnvironment = hre.fhevm;

    let tx;

    // Both values are 100
    const a = 100;
    const b = 100;

    const inputA = await fhevm
      .createEncryptedInput(contractAddress, signers.alice.address)
      .add8(a)
      .encrypt();
    tx = await contract
      .connect(signers.alice)
      .setA(inputA.handles[0], inputA.inputProof);
    await tx.wait();

    const inputB = await fhevm
      .createEncryptedInput(contractAddress, signers.alice.address)
      .add8(b)
      .encrypt();
    tx = await contract
      .connect(signers.alice)
      .setB(inputB.handles[0], inputB.inputProof);
    await tx.wait();

    tx = await contract.connect(bob).compareAEqualsB();
    await tx.wait();

    const encryptedResult = await contract.result();

    const clearResult = await fhevm.userDecryptEbool(
      encryptedResult,
      contractAddress,
      bob
    );

    expect(clearResult).to.equal(true);
  });

  it("should return false when a does not equal b", async function () {
    const fhevm: HardhatFhevmRuntimeEnvironment = hre.fhevm;

    let tx;

    // Different values
    const a = 100;
    const b = 50;

    const inputA = await fhevm
      .createEncryptedInput(contractAddress, signers.alice.address)
      .add8(a)
      .encrypt();
    tx = await contract
      .connect(signers.alice)
      .setA(inputA.handles[0], inputA.inputProof);
    await tx.wait();

    const inputB = await fhevm
      .createEncryptedInput(contractAddress, signers.alice.address)
      .add8(b)
      .encrypt();
    tx = await contract
      .connect(signers.alice)
      .setB(inputB.handles[0], inputB.inputProof);
    await tx.wait();

    tx = await contract.connect(bob).compareAEqualsB();
    await tx.wait();

    const encryptedResult = await contract.result();

    const clearResult = await fhevm.userDecryptEbool(
      encryptedResult,
      contractAddress,
      bob
    );

    expect(clearResult).to.equal(false);
  });
});

```

{% endtab %}

{% endtabs %}
