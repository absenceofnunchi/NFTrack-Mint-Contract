const NFTrack = artifacts.require("NFTrack");
const SimplePayment = artifacts.require("SimplePayment");

contract('SimplePayment on its own separate contract', (accounts) => {
    let NFTrackContract, priceInput, admin, seller, buyer, tokenId, noAccount;
    before(async function () {
        admin = accounts[0];
        seller = accounts[1];
        buyer = accounts[2];
        noAccount = "0x0000000000000000000000000000000000000000"

        priceInput = web3.utils.toWei("1", "ether");
        // priceInput = 100;
        NFTrackContract = await NFTrack.deployed( { from: admin });
    });

    describe("First sale", async () => {
        let simplePaymentContract;
        before(async function () {
            simplePaymentContract = await SimplePayment.deployed(priceInput, admin, { from: seller });
        });

        it("Successfully deploy a SimplePayment contract", async () => {
            const fetchedSeller = await simplePaymentContract.seller.call();
            const price = await simplePaymentContract.price.call()
            const paid = await simplePaymentContract.paid.call()
        
            assert.equal(fetchedSeller, seller, "The seller is incorrect.");
            assert.equal(price, priceInput, "The price for the item is incorrect.")
            assert.equal(paid, false, "The paid variable should be false.")
        })
    
        it("Successfully mint a token and transfer it to SimplePayment contract.", async () => {
            const result = await NFTrackContract.mintNft(simplePaymentContract.address, { from: seller });
            const newlyMintedTokenId = result.logs[0].args.tokenId.toNumber();
    
            tokenId = await simplePaymentContract.tokenId.call();
            const fetchedSeller = await simplePaymentContract.seller.call();
            const tokenAdded = await simplePaymentContract.tokenAdded.call();
        
            assert.equal(tokenId.toNumber(), newlyMintedTokenId, "The token ID is incorrect.");
            assert.equal(fetchedSeller, seller, "Only the seller can transfer the token");
            assert.isTrue(tokenAdded, "The tokenAdded variable is not set to true.");
        })
    
        it("Successfully paid for the token and tranferred the ownership of the token to the new buyer.", async () => {
            let result;
            try {
                result = await simplePaymentContract.pay({ from: buyer, value: priceInput });
            } catch (e) {
                console.log(e)
            }
    
            const buyerInEvent = result.receipt.logs[0].args["0"];
            const paymentAmountInEvent = result.receipt.logs[0].args["1"];
            const paid = await simplePaymentContract.paid.call();
            const payment = await simplePaymentContract.payment.call();
            const fee = await simplePaymentContract.fee.call();
    
            const calculatedFee = priceInput * 2 / 100;
            const expectedFee = calculatedFee.toString();
    
            const calculatedPayment = priceInput - calculatedFee;
            const expectedPayment = calculatedPayment.toString();
    
            assert.isTrue(paid, "The paid property is not toggled to true.");
            assert.equal(fee.toString(), expectedFee, "Incorrect fee.");
            assert.equal(payment, expectedPayment, "The price input and the received amount in the smart contract are different.");
            assert.equal(buyerInEvent, buyer, "The buyer is different from what's in the event.");
            assert.equal(paymentAmountInEvent, priceInput, "The payment amount is different from what's in the event.");
        })
    })

    describe('Resale', async () => {
        let resaleSimplePaymentContract;
        before(async function () {
            // Now the buyer is the new seller since they are the owner of the minted token
            resaleSimplePaymentContract = await SimplePayment.new(priceInput, admin, { from: buyer });
        })

        it("Successfully deploy a new instance of SimplePayment contract for resale.", async () => {
            const newSeller = await resaleSimplePaymentContract.seller.call();
            const price = await resaleSimplePaymentContract.price.call();
            const paid = await resaleSimplePaymentContract.paid.call();
            const tokenAdded = await resaleSimplePaymentContract.tokenAdded.call();
            const resaleTokenId = await resaleSimplePaymentContract.tokenId.call();


            assert.equal(newSeller, buyer, "The seller is incorrect.");
            assert.equal(price, priceInput, "The price for the item is incorrect.");
            assert.equal(paid, false, "The paid variable should be false.");
            assert.isFalse(tokenAdded, "The tokenAdded variable is not set to false.");
            assert.equal(resaleTokenId.toNumber(), 0, "No token should be present.");
        })

        it("Successfully transfer the newly bought token into the new SimplePayment contract for resale.", async () => {
            const ownerAddress = await NFTrackContract.ownerOf(tokenId);
            assert.equal(ownerAddress, buyer, "The current user (buyer) doesn't own the token they're trying to resell.");

            const approvedAddress = await NFTrackContract.getApproved(tokenId);
            assert.equal(approvedAddress.toString(), noAccount, "Wrong approved address. No account should be approved at the moment.");

            const result = await NFTrackContract.safeTransferFrom(buyer, resaleSimplePaymentContract.address, tokenId, { from: buyer });
            const transferEvent = result.receipt.logs[0].args;

            assert.equal(transferEvent["0"], buyer, "Wrong sender included in the event.");
            assert.equal(transferEvent.owner, buyer, "Wrong owner included in the event.");
            assert.equal(transferEvent.tokenId.toNumber(), tokenId, "Wrong token included in the event.");
            assert.equal(transferEvent.approved, noAccount, "Wrong approved account included in the event.");
            
            const tokenAdded = await resaleSimplePaymentContract.tokenAdded.call();
            assert.isTrue(tokenAdded, "The tokenAdded variable is not set to true.");

            const resaleTokenId = await resaleSimplePaymentContract.tokenId.call();
            assert.equal(resaleTokenId.toNumber(), tokenId.toNumber(), "No token should be present.");
        })
    })
})