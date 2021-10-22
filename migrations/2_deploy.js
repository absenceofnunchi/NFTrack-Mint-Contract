const NFTrack = artifacts.require("NFTrack");
const simplePayment = artifacts.require("SimplePayment");

module.exports = function(deployer, _, accounts) {
    const admin = accounts[0];
    const seller = accounts[1];
    const price = web3.utils.toWei("1", "ether");

    deployer.deploy(NFTrack);
    deployer.deploy(simplePayment, price, admin, { from: seller });
}