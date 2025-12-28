import {
  FhevmType,
  HardhatFhevmRuntimeEnvironment,
} from "@fhevm/hardhat-plugin";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers } from "hardhat";
import * as hre from "hardhat";

import { BlindAuction, BlindAuction__factory } from "../../types";
import type { Signers } from "../types";

async function deployFixture() {
  // Set auction duration to 1 hour
  const biddingTime = 3600;
  const factory = (await ethers.getContractFactory(
    "BlindAuction"
  )) as BlindAuction__factory;
  const blindAuction = (await factory.deploy(biddingTime)) as BlindAuction;
  const blindAuction_address = await blindAuction.getAddress();

  return { blindAuction, blindAuction_address, biddingTime };
}

/**
 * This example demonstrates a blind auction with encrypted bids.
 * Tests verify bid placement, comparison, and auction flow.
 */
describe("BlindAuction", function () {
  let contract: BlindAuction;
  let contractAddress: string;
  let signers: Signers;
  let bob: HardhatEthersSigner;
  let charlie: HardhatEthersSigner;

  before(async function () {
    if (!hre.fhevm.isMock) {
      throw new Error(`This hardhat test suite cannot run on Sepolia Testnet`);
    }

    const ethSigners: HardhatEthersSigner[] = await ethers.getSigners();
    signers = { owner: ethSigners[0], alice: ethSigners[1] };
    bob = ethSigners[2];
    charlie = ethSigners[3];
  });

  beforeEach(async function () {
    const deployment = await deployFixture();
    contractAddress = deployment.blindAuction_address;
    contract = deployment.blindAuction;
  });

  it("should allow placing encrypted bids", async function () {
    const fhevm: HardhatFhevmRuntimeEnvironment = hre.fhevm;

    // Alice bids 100
    const aliceBid = 100n;
    const aliceInput = await fhevm
      .createEncryptedInput(contractAddress, signers.alice.address)
      .add64(aliceBid)
      .encrypt();

    await expect(
      contract
        .connect(signers.alice)
        .bid(aliceInput.handles[0], aliceInput.inputProof)
    )
      .to.emit(contract, "BidPlaced")
      .withArgs(signers.alice.address);

    expect(await contract.getBidderCount()).to.equal(1);
  });

  it("should track multiple bidders", async function () {
    const fhevm: HardhatFhevmRuntimeEnvironment = hre.fhevm;

    // Alice bids 100
    const aliceInput = await fhevm
      .createEncryptedInput(contractAddress, signers.alice.address)
      .add64(100n)
      .encrypt();
    let tx = await contract
      .connect(signers.alice)
      .bid(aliceInput.handles[0], aliceInput.inputProof);
    await tx.wait();

    // Bob bids 150
    const bobInput = await fhevm
      .createEncryptedInput(contractAddress, bob.address)
      .add64(150n)
      .encrypt();
    tx = await contract
      .connect(bob)
      .bid(bobInput.handles[0], bobInput.inputProof);
    await tx.wait();

    // Charlie bids 75
    const charlieInput = await fhevm
      .createEncryptedInput(contractAddress, charlie.address)
      .add64(75n)
      .encrypt();
    tx = await contract
      .connect(charlie)
      .bid(charlieInput.handles[0], charlieInput.inputProof);
    await tx.wait();

    expect(await contract.getBidderCount()).to.equal(3);
  });

  it("should allow bidder to retrieve their own bid", async function () {
    const fhevm: HardhatFhevmRuntimeEnvironment = hre.fhevm;
    const bidAmount = 250n;

    // Alice places a bid
    const aliceInput = await fhevm
      .createEncryptedInput(contractAddress, signers.alice.address)
      .add64(bidAmount)
      .encrypt();
    let tx = await contract
      .connect(signers.alice)
      .bid(aliceInput.handles[0], aliceInput.inputProof);
    await tx.wait();

    // Alice retrieves her bid
    tx = await contract.connect(signers.alice).getMyBid();
    await tx.wait();

    // Get the encrypted bid and decrypt
    const encryptedBid = await contract
      .connect(signers.alice)
      .getMyBid.staticCall();
    const decryptedBid = await fhevm.userDecryptEuint(
      FhevmType.euint64,
      encryptedBid,
      contractAddress,
      signers.alice
    );

    expect(decryptedBid).to.equal(bidAmount);
  });

  it("should allow bidder to check if their bid is highest", async function () {
    const fhevm: HardhatFhevmRuntimeEnvironment = hre.fhevm;

    // Alice bids 100
    const aliceInput = await fhevm
      .createEncryptedInput(contractAddress, signers.alice.address)
      .add64(100n)
      .encrypt();
    let tx = await contract
      .connect(signers.alice)
      .bid(aliceInput.handles[0], aliceInput.inputProof);
    await tx.wait();

    // Bob bids higher: 200
    const bobInput = await fhevm
      .createEncryptedInput(contractAddress, bob.address)
      .add64(200n)
      .encrypt();
    tx = await contract
      .connect(bob)
      .bid(bobInput.handles[0], bobInput.inputProof);
    await tx.wait();

    // Alice checks if her bid is highest (it shouldn't be)
    tx = await contract.connect(signers.alice).isMyBidHighest();
    await tx.wait();

    const encryptedResult = await contract
      .connect(signers.alice)
      .isMyBidHighest.staticCall();
    const isHighest = await fhevm.userDecryptEbool(
      encryptedResult,
      contractAddress,
      signers.alice
    );
    expect(isHighest).to.equal(false);

    // Bob checks if his bid is highest (it should be)
    tx = await contract.connect(bob).isMyBidHighest();
    await tx.wait();

    const bobEncryptedResult = await contract
      .connect(bob)
      .isMyBidHighest.staticCall();
    const bobIsHighest = await fhevm.userDecryptEbool(
      bobEncryptedResult,
      contractAddress,
      bob
    );
    expect(bobIsHighest).to.equal(true);
  });

  it("should allow updating a bid", async function () {
    const fhevm: HardhatFhevmRuntimeEnvironment = hre.fhevm;

    // Alice initially bids 100
    let aliceInput = await fhevm
      .createEncryptedInput(contractAddress, signers.alice.address)
      .add64(100n)
      .encrypt();
    let tx = await contract
      .connect(signers.alice)
      .bid(aliceInput.handles[0], aliceInput.inputProof);
    await tx.wait();

    // Alice updates to 300
    aliceInput = await fhevm
      .createEncryptedInput(contractAddress, signers.alice.address)
      .add64(300n)
      .encrypt();
    tx = await contract
      .connect(signers.alice)
      .bid(aliceInput.handles[0], aliceInput.inputProof);
    await tx.wait();

    // Still only 1 bidder
    expect(await contract.getBidderCount()).to.equal(1);

    // Verify updated bid
    tx = await contract.connect(signers.alice).getMyBid();
    await tx.wait();

    const encryptedBid = await contract
      .connect(signers.alice)
      .getMyBid.staticCall();
    const decryptedBid = await fhevm.userDecryptEuint(
      FhevmType.euint64,
      encryptedBid,
      contractAddress,
      signers.alice
    );

    expect(decryptedBid).to.equal(300n);
  });
});
