Demonstrates FHE.sub() for subtracting encrypted values

{% hint style="info" %}
To run this example correctly, make sure the files are placed in the following directories:

- `.sol` file → `<your-project-root-dir>/contracts/`
- `.ts` file → `<your-project-root-dir>/test/`

This ensures Hardhat can compile and test your contracts as expected.
{% endhint %}

{% tabs %}

{% tab title="FHESub.sol" %}

```solidity
// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import { FHE, euint8, externalEuint8 } from "@fhevm/solidity/lib/FHE.sol";
import { ZamaEthereumConfig } from "@fhevm/solidity/config/ZamaConfig.sol";

/**
 * @title FHESub
 * @notice Demonstrates FHE subtraction operation on encrypted values.
 * @dev This example shows how to perform subtraction using FHE.sub()
 *      while maintaining proper FHE permissions for the result.
 */
contract FHESub is ZamaEthereumConfig {
  euint8 private _a;
  euint8 private _b;
  // solhint-disable-next-line var-name-mixedcase
  euint8 private _a_minus_b;

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
   * @notice Computes the subtraction of two encrypted values (a - b).
   * @dev The contract must have FHE permissions over both operands.
   *      After computation, permissions are granted to both the contract
   *      and the caller for decryption.
   *      Note: If b > a, the result will underflow (wrap around) due to
   *      unsigned integer arithmetic.
   */
  function computeAMinusB() external {
    // Perform FHE subtraction - the contract needs permission on both values
    _a_minus_b = FHE.sub(_a, _b);

    // Grant permanent FHE permissions for the result
    FHE.allowThis(_a_minus_b);
    FHE.allow(_a_minus_b, msg.sender);
  }

  function result() public view returns (euint8) {
    return _a_minus_b;
  }
}

```

{% endtab %}

{% tab title="FHESub.ts" %}

```typescript
import {
  FhevmType,
  HardhatFhevmRuntimeEnvironment,
} from "@fhevm/hardhat-plugin";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers } from "hardhat";
import * as hre from "hardhat";

import { FHESub, FHESub__factory } from "../../../types";
import type { Signers } from "../../types";

async function deployFixture() {
  const factory = (await ethers.getContractFactory(
    "FHESub"
  )) as FHESub__factory;
  const fheSub = (await factory.deploy()) as FHESub;
  const fheSub_address = await fheSub.getAddress();

  return { fheSub, fheSub_address };
}

/**
 * This example demonstrates FHE subtraction operation.
 * Tests verify correct computation of a - b on encrypted values.
 */
describe("FHESub", function () {
  let contract: FHESub;
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
    contractAddress = deployment.fheSub_address;
    contract = deployment.fheSub;
  });

  it("a - b should succeed when a > b", async function () {
    const fhevm: HardhatFhevmRuntimeEnvironment = hre.fhevm;

    let tx;

    // Let's compute 200 - 50 = 150
    const a = 200;
    const b = 50;

    // Alice encrypts and sets `a` as 200
    const inputA = await fhevm
      .createEncryptedInput(contractAddress, signers.alice.address)
      .add8(a)
      .encrypt();
    tx = await contract
      .connect(signers.alice)
      .setA(inputA.handles[0], inputA.inputProof);
    await tx.wait();

    // Alice encrypts and sets `b` as 50
    const inputB = await fhevm
      .createEncryptedInput(contractAddress, signers.alice.address)
      .add8(b)
      .encrypt();
    tx = await contract
      .connect(signers.alice)
      .setB(inputB.handles[0], inputB.inputProof);
    await tx.wait();

    // Bob computes the result
    tx = await contract.connect(bob).computeAMinusB();
    await tx.wait();

    const encryptedResult = await contract.result();

    const clearResult = await fhevm.userDecryptEuint(
      FhevmType.euint8,
      encryptedResult,
      contractAddress,
      bob
    );

    expect(clearResult).to.equal(a - b);
  });

  it("a - b should wrap around (underflow) when b > a", async function () {
    const fhevm: HardhatFhevmRuntimeEnvironment = hre.fhevm;

    let tx;

    // Let's compute 10 - 50 = 216 (underflow: 256 - 40 = 216)
    const a = 10;
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

    tx = await contract.connect(bob).computeAMinusB();
    await tx.wait();

    const encryptedResult = await contract.result();

    const clearResult = await fhevm.userDecryptEuint(
      FhevmType.euint8,
      encryptedResult,
      contractAddress,
      bob
    );

    // euint8 wraps around: 10 - 50 = 256 + (10 - 50) = 216
    expect(clearResult).to.equal(216);
  });
});

```

{% endtab %}

{% endtabs %}
