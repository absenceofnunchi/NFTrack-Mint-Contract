// Gas cost (at 100 Gwei)
// deployment of NFTrack: 3086672, $1,444.08
// createSimpePayment: 183996, $86.08
// pay: 107475, $50.28
// withdraw: 33275, $15.52
// withdrawFee: 33338, $15.55
// resell: 114096, $53.22

// deployement of SimplePayment: 806253, $376.64
// mint and transfer: 131368, $61.37
// pay: 137490, $64.23

const NFTrack = artifacts.require("NFTrack");

contract('SimplePayment through NFTrack', (accounts) => {
    let NFTrackContract, priceInput, admin, seller, itemId, newItemId, buyer, anotherBuyer, tokenId, noAccount;
    before(async function () {
        admin = accounts[0];
        seller = accounts[1];
        itemId = accounts[2];
        buyer = accounts[3];
        anotherBuyer = accounts[4];
        noAccount = "0x0000000000000000000000000000000000000000";
        newItemId = accounts[5];

        priceInput = web3.utils.toWei("1", "ether");
        // priceInput = 100;
        NFTrackContract = await NFTrack.deployed(admin, { from: admin });
    });

    it("NFTrack has been successfully deployed", async () => {
        const fetchedAdmin = await NFTrackContract.checkAdmin();
        const symbol = await NFTrackContract.symbol();

        assert.equal(fetchedAdmin, admin, "The admin is incorrect.");
        assert.equal(symbol, "TRK", "Wrong symbol");
    })

    it("create simple payment", async () => {
        let result;
        try {
            result = await NFTrackContract.createSimplePayment(seller, priceInput, itemId, { from: seller });
            // console.log("result", result)
        } catch (e) {
            console.log("createSimpePayment", e)
        }

        // Parse event
        tokenId = result.receipt.logs[0].args.tokenId.toNumber();
        
        const onSale = await NFTrackContract.checkOnSale(tokenId);
        const ownerAddress = await NFTrackContract.ownerOf(tokenId);
        const balance = await NFTrackContract.balanceOf(ownerAddress);
        const approvedAddress = await NFTrackContract.getApproved(tokenId);
        const paymentStruct = await NFTrackContract.checkSimplePayment(itemId);
        const itemPrice = paymentStruct["1"];
        const itemToken = paymentStruct["3"];
        const sellerAddress = paymentStruct["4"];

        assert.isTrue(onSale, "The status of the token should be listed for sale.");
        assert.equal(ownerAddress, seller, "The seller is not the owner of the newly minted token.");
        assert.equal(balance, tokenId, "Wrong token ID");
        assert.equal(approvedAddress, noAccount, "No account should be approved.");
        assert.equal(itemPrice.toString(), priceInput, "Wrong price has been set to the Payment struct.");
        assert.equal(itemToken, tokenId, "Wrong token ID has been set to the Payment struct.");
        assert.equal(sellerAddress, seller, "Wrong seller has been set to the Payment struct.");
    })

    it("pay for the item", async () => {
        // Attempt to resell before selling which is an attempt to register the same token twice. 
        try {
            await NFTrackContract.resell(priceInput, itemId, tokenId, { from: seller })
        } catch (e) {
            assert.equal(e.reason, 'The token is already listed for sale.', "The token should not be allowed to be re-registered before selling.")
        }

        // Pay the incorrect amount
        const wrongPrice = await web3.utils.toWei("2", "ether");
        try {
            await NFTrackContract.pay(itemId, { from: buyer, value: wrongPrice });
        } catch (e) {
            assert.equal(e.reason, "Incorrect price.", "The pay is supposed to fail due to the wrong price.");
        }

        // Pay the correct amount and check the event
        let result;
        try {
            result = await NFTrackContract.pay(itemId, { from: buyer, value: priceInput });
        } catch (e) {
            console.log(e);
        }

        // Another attempt at purchaseing the token should fail because the price is set to 0
        try {
            await NFTrackContract.pay(itemId, { from: buyer, value: priceInput });
        } catch (e) {
            assert.equal(e.reason, "Not for sale.", "The sale should be prevent.");
        }
        
        // Check the PaymentMade event.
        const paymentMadeEvent = result.receipt.logs[0].args;
        const sender = paymentMadeEvent["0"];
        const paymentValue = paymentMadeEvent["2"];
        const formattedValue = web3.utils.toWei(paymentValue).toString();

        const paymentStruct = await NFTrackContract.checkSimplePayment(itemId);
        const itemPayment = paymentStruct["0"];
        const itemPrice = paymentStruct["1"];
        const fee = paymentStruct["2"];
        const itemToken = paymentStruct["3"];
        const sellerAddress = paymentStruct["4"]; 

        // Check the balance and the ownership of the token
        const ownerAddress = await NFTrackContract.ownerOf(itemToken);
        const balance = await NFTrackContract.balanceOf(buyer);
        const onSale = await NFTrackContract.checkOnSale(tokenId);

        assert.equal(sender, seller, "Wrong seller in event.");
        assert.equal(formattedValue, priceInput, "Wrong price value in event.");
        assert.equal(itemPayment.toString(), priceInput - fee, "Wrong payment ammount in the Payment struct.")
        assert.equal(fee.toString(), priceInput * 2 / 100, "Wrong fee amount in the Payment struct.");
        assert.equal(itemToken.toNumber(), tokenId, "Wrong token ID in the Payment struct.");
        assert.equal(sellerAddress, seller, "Wrong seller address in the Payment struct.");
        assert.equal(itemPrice, 0, "The updated item price should be 0 in the Payment struct.");
        assert.equal(ownerAddress, buyer, "The new owner of the token after the purchase is incorrect.");
        assert.equal(balance, tokenId, "The balance of the buyer after the purchase is incorrect. #1");
        assert.equal(balance.toString(), itemToken.toString(), "The balance of the buyer after the purchase is incorrect. #2");
        assert.isFalse(onSale, "The status of the token should not be listed for sale.");
    })

    it("The seller successfullly withdraws their fund.", async () => {
        // Withdraw attempt by a non-authorized person.
        try {
            const result = await NFTrackContract.withdraw(itemId, { from: buyer });
            console.log("withdraw result", result);
        } catch (e) {
            assert.equal(e.reason, "Not authorized.", "Withdraw should not be authorized.")
        }

        // Succeed in withdrawing
        try {
            await NFTrackContract.withdraw(itemId, { from: seller });
        } catch (e) {
            console.log(e)
        }

        const paymentStruct = await NFTrackContract.checkSimplePayment(itemId);
        const itemPayment = paymentStruct["0"];
        const fee = paymentStruct["2"];
        const withdrawAmount = priceInput - fee

        assert.equal(withdrawAmount, itemPayment.toString(), "Incorrect withdraw amount.");
    })

    it("The admin successfully withdraws the commission.", async () => {
        // Unauthorized attempt to withdraw the fee.
        try {
            const result = await NFTrackContract.withdrawFee(itemId, { from: seller })
        } catch (e) {
            assert.equal(e.reason, "Not authorized to withdraw the fee.", "The unauthorized attempt should be reverted.")
        }

        // Authorized withdraw
        try {
            await NFTrackContract.withdrawFee(itemId, { from: admin })
        } catch (e) {
            console.log(e);
        }

        const paymentStruct = await NFTrackContract.checkSimplePayment(itemId);
        const fee = paymentStruct["2"];
        const expectedFee = priceInput * 2 / 100;

        assert.equal(fee, expectedFee, "Incorrect fee.");
    })

    it("Successfully resell", async () => {
        // Attempt to resell by an unauthorized user.
        try {
            await NFTrackContract.resell(priceInput, newItemId, tokenId, { from: seller })
        } catch (e) {
            assert.equal(e.reason, "You are not the owner of the token.", "The transaction should fail due to a call by an unauthorized user.")
        }

        // Incorrect amount for reselling (0 or less)
        try {
            await NFTrackContract.resell(0, newItemId, tokenId, { from: buyer })
        } catch (e) {
            assert.equal(e.reason, "The price has to be greater than 0", "The transaction should fail due to an incorrect pricing.")
        }

        // Successful resell
        try {
            await NFTrackContract.resell(priceInput, newItemId, tokenId, { from: buyer })
        } catch (e) {
            console.log(e)
        }

        // The onSale has to be toggled to true
        const onSale = await NFTrackContract.checkOnSale(tokenId);

        // A new Payment struct has to be set with newItemId in _simplePayment mapping
        const paymentStruct = await NFTrackContract.checkSimplePayment(newItemId);
        const itemPayment = paymentStruct["0"];
        const itemPrice = paymentStruct["1"];
        const fee = paymentStruct["2"];
        const itemToken = paymentStruct["3"];
        const sellerAddress = paymentStruct["4"]; 

        assert.isTrue(onSale, "The status of the token should be listed for sale.");
        assert.equal(itemPayment.toString(), 0, "Wrong payment ammount in the Payment struct.")
        assert.equal(itemPrice.toString(), priceInput, "Wrong price has been set to the Payment struct.");
        assert.equal(fee.toString(), 0, "Wrong fee amount in the Payment struct.");
        assert.equal(itemToken.toNumber(), tokenId, "Wrong token ID in the Payment struct.");
        assert.equal(sellerAddress, buyer, "Wrong seller address in the Payment struct.");
    })
})