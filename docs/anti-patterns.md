Documentation for AntiPatterns

{% hint style="info" %}
To run this example correctly, make sure the files are placed in the following directories:

- `.sol` file → `<your-project-root-dir>/contracts/`
- `.ts` file → `<your-project-root-dir>/test/`

This ensures Hardhat can compile and test your contracts as expected.
{% endhint %}

{% tabs %}

{% tab title="AntiPatterns.sol" %}

```solidity
// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import { FHE, euint8, externalEuint8 } from "@fhevm/solidity/lib/FHE.sol";
import { ZamaEthereumConfig } from "@fhevm/solidity/config/ZamaConfig.sol";

/**
 * @title AntiPatterns
 * @notice Demonstrates common FHEVM mistakes and how to avoid them.
 * @dev This contract shows both WRONG and CORRECT patterns side by side.
 *
 *      ANTI-PATTERN #1: View functions returning encrypted values
 *      - View functions can't grant permissions, so returned values are useless
 *
 *      ANTI-PATTERN #2: Missing FHE.allowThis() after operations
 *      - Contract loses access to computed values after tx ends
 *
 *      ANTI-PATTERN #3: Trying to read encrypted value directly
 *      - Encrypted values can only be read via proper decryption flow
 */
contract AntiPatterns is ZamaEthereumConfig {
  euint8 private _secretValue;
  euint8 private _computedValue;

  event CorrectlyStored();
  event CorrectlyComputed();

  // solhint-disable-next-line no-empty-blocks
  constructor() {}

  // ============================================
  // ANTI-PATTERN #1: View functions with encrypted returns
  // ============================================

  /**
   * @notice WRONG: A view function that returns encrypted value.
   * @dev This is problematic because:
   *      1. View functions cannot modify state
   *      2. Therefore, they cannot call FHE.allow() to grant permissions
   *      3. The returned handle is useless without permissions
   *
   *      The value IS returned, but caller cannot decrypt it!
   */
  function wrongGetSecret() public view returns (euint8) {
    // Returns the handle, but caller has no permission to decrypt
    return _secretValue;
  }

  /**
   * @notice CORRECT: Use a non-view function to grant access before returning.
   */
  function correctGetSecret() public returns (euint8) {
    // Grant permission to caller (this requires state change, not a view)
    FHE.allow(_secretValue, msg.sender);
    return _secretValue;
  }

  // ============================================
  // ANTI-PATTERN #2: Missing FHE.allowThis()
  // ============================================

  /**
   * @notice WRONG: Store value without granting contract permission.
   * @dev Without FHE.allowThis(), the contract cannot use this value
   *      in future transactions!
   */
  function wrongStoreValue(externalEuint8 input, bytes calldata inputProof) external {
    _secretValue = FHE.fromExternal(input, inputProof);
    // Missing: FHE.allowThis(_secretValue);
    // The value is stored but contract can't use it in next tx!
  }

  /**
   * @notice CORRECT: Always grant contract permission after storing.
   */
  function correctStoreValue(externalEuint8 input, bytes calldata inputProof) external {
    _secretValue = FHE.fromExternal(input, inputProof);
    FHE.allowThis(_secretValue); // Contract can now use this value
    emit CorrectlyStored();
  }

  /**
   * @notice WRONG: Compute without preserving permissions.
   * @dev After FHE operations, permission is ephemeral only.
   */
  function wrongCompute() external {
    euint8 result = FHE.add(_secretValue, FHE.asEuint8(10));
    _computedValue = result;
    // Missing: FHE.allowThis() - permission lost after tx!
  }

  /**
   * @notice CORRECT: Grant permissions after each operation.
   */
  function correctCompute() external {
    euint8 result = FHE.add(_secretValue, FHE.asEuint8(10));
    FHE.allowThis(result);
    FHE.allow(result, msg.sender);
    _computedValue = result;
    emit CorrectlyComputed();
  }

  // ============================================
  // ANTI-PATTERN #3: Expecting to read values directly
  // ============================================

  /**
   * @notice This function exists to show what NOT to expect.
   * @dev You cannot just "read" an encrypted value and see the plaintext.
   *      The only way to see the actual value is:
   *      1. For user: Use userDecrypt with proper permissions
   *      2. For everyone: Use public decrypt (reveals to all)
   *
   *      The handle returned is just an identifier, not the value!
   */
  function getComputedValue() public view returns (euint8) {
    // This returns a handle (bytes32-like), NOT the actual number
    // To get actual value, decrypt off-chain with permissions
    return _computedValue;
  }

  // ============================================
  // ANTI-PATTERN #4: Using encrypted in require/conditionals
  // ============================================

  /**
   * @notice WRONG: You cannot use encrypted values in require statements.
   * @dev This will NOT compile because ebool cannot be used as a boolean.
   *      Encrypted values are handles, not actual booleans!
   *
   *      // This won't work:
   *      // require(FHE.decrypt(isValid), "Invalid"); // decrypt not available
   *      // if (encryptedBool) { ... } // type error
   */
  // function wrongConditionalCheck() external view {
  //   ebool isValid = FHE.eq(_secretValue, FHE.asEuint8(100));
  //   require(isValid, "Must be 100"); // COMPILE ERROR: ebool is not bool
  // }

  /**
   * @notice CORRECT: Use FHE.select for conditional logic on encrypted values.
   * @dev Instead of if/else, use FHE.select(condition, trueValue, falseValue)
   */
  function correctConditionalLogic(externalEuint8 input, bytes calldata inputProof) external {
    euint8 value = FHE.fromExternal(input, inputProof);
    FHE.allowThis(value);

    // Instead of: if (value > 100) { result = value; } else { result = 0; }
    // Use FHE.select:
    euint8 threshold = FHE.asEuint8(100);
    euint8 zero = FHE.asEuint8(0);
    euint8 result = FHE.select(FHE.gt(value, threshold), value, zero);

    FHE.allowThis(result);
    FHE.allow(result, msg.sender);
    _computedValue = result;
    emit CorrectlyComputed();
  }

  // ============================================
  // ANTI-PATTERN #5: Ignoring overflow behavior
  // ============================================

  /**
   * @notice WARNING: FHE arithmetic wraps around silently.
   * @dev Unlike Solidity 0.8+ which reverts on overflow,
   *      FHE operations wrap around (modular arithmetic).
   *      euint8: 255 + 1 = 0, 0 - 1 = 255
   *
   *      This is by design but can cause unexpected behavior!
   */
  function demonstrateOverflow() external {
    euint8 maxValue = FHE.asEuint8(255);
    euint8 one = FHE.asEuint8(1);

    // This will be 0, NOT revert!
    euint8 overflowed = FHE.add(maxValue, one);

    FHE.allowThis(overflowed);
    FHE.allow(overflowed, msg.sender);
    _computedValue = overflowed;
  }

  /**
   * @notice CORRECT: Add bounds checking before operations if needed.
   * @dev Use FHE.min/FHE.max or conditional logic to prevent overflow.
   */
  function correctBoundedAdd(externalEuint8 input, bytes calldata inputProof) external {
    euint8 value = FHE.fromExternal(input, inputProof);
    FHE.allowThis(value);

    euint8 toAdd = FHE.asEuint8(10);
    euint8 maxSafe = FHE.asEuint8(245); // 255 - 10

    // Cap the value before adding to prevent overflow
    euint8 safeValue = FHE.min(value, maxSafe);
    euint8 result = FHE.add(safeValue, toAdd);

    FHE.allowThis(result);
    FHE.allow(result, msg.sender);
    _computedValue = result;
    emit CorrectlyComputed();
  }

  // ============================================
  // ANTI-PATTERN #6: Unnecessary re-encryption
  // ============================================

  /**
   * @notice WRONG: Re-encrypting already encrypted values wastes gas.
   * @dev FHE.asEuintXX on a constant creates a new ciphertext each time.
   *      Store constants once instead of recreating them.
   */
  function wrongRepeatedEncryption() external {
    // Each call creates a NEW ciphertext for the same value - wasteful!
    euint8 result = FHE.add(_secretValue, FHE.asEuint8(10));
    result = FHE.add(result, FHE.asEuint8(10)); // Another encryption!
    result = FHE.add(result, FHE.asEuint8(10)); // And another!

    FHE.allowThis(result);
    _computedValue = result;
  }

  // Storage slot for reusable constant
  euint8 private _constantTen;

  /**
   * @notice CORRECT: Store encrypted constants once and reuse them.
   */
  function initializeConstant() external {
    _constantTen = FHE.asEuint8(10);
    FHE.allowThis(_constantTen);
  }

  function correctReuseEncryption() external {
    // Reuse the stored constant instead of re-encrypting
    euint8 result = FHE.add(_secretValue, _constantTen);
    result = FHE.add(result, _constantTen);
    result = FHE.add(result, _constantTen);

    FHE.allowThis(result);
    FHE.allow(result, msg.sender);
    _computedValue = result;
    emit CorrectlyComputed();
  }
}

```

{% endtab %}

{% tab title="AntiPatterns.ts" %}

```typescript
import {
  FhevmType,
  HardhatFhevmRuntimeEnvironment,
} from "@fhevm/hardhat-plugin";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers } from "hardhat";
import * as hre from "hardhat";

import { AntiPatterns, AntiPatterns__factory } from "../../../types";
import type { Signers } from "../../types";

async function deployFixture() {
  const factory = (await ethers.getContractFactory(
    "AntiPatterns"
  )) as AntiPatterns__factory;
  const antiPatterns = (await factory.deploy()) as AntiPatterns;
  const antiPatterns_address = await antiPatterns.getAddress();

  return { antiPatterns, antiPatterns_address };
}

/**
 * This example demonstrates common FHEVM anti-patterns.
 * Tests show the difference between wrong and correct approaches.
 */
describe("AntiPatterns", function () {
  let contract: AntiPatterns;
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
    contractAddress = deployment.antiPatterns_address;
    contract = deployment.antiPatterns;
  });

  describe("Anti-Pattern #1: View functions", function () {
    it("CORRECT: non-view function grants access for decryption", async function () {
      const fhevm: HardhatFhevmRuntimeEnvironment = hre.fhevm;
      const secretValue = 42;

      // First store correctly
      const input = await fhevm
        .createEncryptedInput(contractAddress, signers.alice.address)
        .add8(secretValue)
        .encrypt();
      let tx = await contract
        .connect(signers.alice)
        .correctStoreValue(input.handles[0], input.inputProof);
      await tx.wait();

      // Use correct function that grants permission
      tx = await contract.connect(signers.alice).correctGetSecret();
      await tx.wait();

      // Now we can decrypt
      const encrypted = await contract.wrongGetSecret(); // view is fine for getting handle after permission
      const decrypted = await fhevm.userDecryptEuint(
        FhevmType.euint8,
        encrypted,
        contractAddress,
        signers.alice
      );
      expect(decrypted).to.equal(secretValue);
    });
  });

  describe("Anti-Pattern #2: Missing FHE.allowThis()", function () {
    it("CORRECT: store with allowThis emits event", async function () {
      const fhevm: HardhatFhevmRuntimeEnvironment = hre.fhevm;

      const input = await fhevm
        .createEncryptedInput(contractAddress, signers.alice.address)
        .add8(100)
        .encrypt();

      await expect(
        contract
          .connect(signers.alice)
          .correctStoreValue(input.handles[0], input.inputProof)
      ).to.emit(contract, "CorrectlyStored");
    });

    it("CORRECT: compute with proper permissions emits event", async function () {
      const fhevm: HardhatFhevmRuntimeEnvironment = hre.fhevm;

      // Store value first
      const input = await fhevm
        .createEncryptedInput(contractAddress, signers.alice.address)
        .add8(50)
        .encrypt();
      let tx = await contract
        .connect(signers.alice)
        .correctStoreValue(input.handles[0], input.inputProof);
      await tx.wait();

      // Compute correctly
      await expect(contract.connect(signers.alice).correctCompute()).to.emit(
        contract,
        "CorrectlyComputed"
      );

      // Verify result
      const encrypted = await contract.getComputedValue();
      const decrypted = await fhevm.userDecryptEuint(
        FhevmType.euint8,
        encrypted,
        contractAddress,
        signers.alice
      );
      expect(decrypted).to.equal(60); // 50 + 10
    });
  });

  describe("Educational Note", function () {
    it("should demonstrate that handles are not values", async function () {
      const fhevm: HardhatFhevmRuntimeEnvironment = hre.fhevm;

      // Store a value
      const input = await fhevm
        .createEncryptedInput(contractAddress, signers.alice.address)
        .add8(123)
        .encrypt();
      let tx = await contract
        .connect(signers.alice)
        .correctStoreValue(input.handles[0], input.inputProof);
      await tx.wait();

      // Get the handle - it's a bytes32-like value, NOT the number 123
      const handle = await contract.wrongGetSecret();

      // The handle is just an identifier - you need decryption to see actual value
      // This is by design - encrypted values stay encrypted on-chain
      expect(handle).to.not.equal(123);
    });
  });

  describe("Anti-Pattern #4: Encrypted conditionals", function () {
    it("CORRECT: should use FHE.select for conditional logic", async function () {
      const fhevm: HardhatFhevmRuntimeEnvironment = hre.fhevm;

      // Value > 100, so result should be the value itself
      const input = await fhevm
        .createEncryptedInput(contractAddress, signers.alice.address)
        .add8(150)
        .encrypt();

      await expect(
        contract
          .connect(signers.alice)
          .correctConditionalLogic(input.handles[0], input.inputProof)
      ).to.emit(contract, "CorrectlyComputed");

      // Verify result is the value (150 > 100)
      const encrypted = await contract.getComputedValue();
      const decrypted = await fhevm.userDecryptEuint(
        FhevmType.euint8,
        encrypted,
        contractAddress,
        signers.alice
      );
      expect(decrypted).to.equal(150);
    });

    it("CORRECT: should return zero when value <= threshold", async function () {
      const fhevm: HardhatFhevmRuntimeEnvironment = hre.fhevm;

      // Value <= 100, so result should be 0
      const input = await fhevm
        .createEncryptedInput(contractAddress, signers.alice.address)
        .add8(50)
        .encrypt();

      let tx = await contract
        .connect(signers.alice)
        .correctConditionalLogic(input.handles[0], input.inputProof);
      await tx.wait();

      const encrypted = await contract.getComputedValue();
      const decrypted = await fhevm.userDecryptEuint(
        FhevmType.euint8,
        encrypted,
        contractAddress,
        signers.alice
      );
      expect(decrypted).to.equal(0);
    });
  });

  describe("Anti-Pattern #5: Overflow behavior", function () {
    it("should demonstrate overflow wraps around to 0", async function () {
      const fhevm: HardhatFhevmRuntimeEnvironment = hre.fhevm;

      // 255 + 1 = 0 (overflow)
      let tx = await contract.connect(signers.alice).demonstrateOverflow();
      await tx.wait();

      const encrypted = await contract.getComputedValue();
      const decrypted = await fhevm.userDecryptEuint(
        FhevmType.euint8,
        encrypted,
        contractAddress,
        signers.alice
      );
      expect(decrypted).to.equal(0); // Wrapped around!
    });

    it("CORRECT: bounded add should cap value to prevent overflow", async function () {
      const fhevm: HardhatFhevmRuntimeEnvironment = hre.fhevm;

      // Input 250, maxSafe=245, so capped to 245, then + 10 = 255
      const input = await fhevm
        .createEncryptedInput(contractAddress, signers.alice.address)
        .add8(250)
        .encrypt();

      await expect(
        contract
          .connect(signers.alice)
          .correctBoundedAdd(input.handles[0], input.inputProof)
      ).to.emit(contract, "CorrectlyComputed");

      const encrypted = await contract.getComputedValue();
      const decrypted = await fhevm.userDecryptEuint(
        FhevmType.euint8,
        encrypted,
        contractAddress,
        signers.alice
      );
      expect(decrypted).to.equal(255); // Capped, no overflow
    });
  });

  describe("Anti-Pattern #6: Unnecessary re-encryption", function () {
    it("CORRECT: should reuse stored constants", async function () {
      const fhevm: HardhatFhevmRuntimeEnvironment = hre.fhevm;

      // Store initial value
      const input = await fhevm
        .createEncryptedInput(contractAddress, signers.alice.address)
        .add8(20)
        .encrypt();
      let tx = await contract
        .connect(signers.alice)
        .correctStoreValue(input.handles[0], input.inputProof);
      await tx.wait();

      // Initialize constant
      tx = await contract.connect(signers.alice).initializeConstant();
      await tx.wait();

      // Reuse encryption: 20 + 10 + 10 + 10 = 50
      await expect(
        contract.connect(signers.alice).correctReuseEncryption()
      ).to.emit(contract, "CorrectlyComputed");

      const encrypted = await contract.getComputedValue();
      const decrypted = await fhevm.userDecryptEuint(
        FhevmType.euint8,
        encrypted,
        contractAddress,
        signers.alice
      );
      expect(decrypted).to.equal(50);
    });
  });
});

```

{% endtab %}

{% endtabs %}
