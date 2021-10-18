// SPDX-License-Identifier: MIT
// pragma solidity >=0.4.22 <0.7.0;
pragma solidity ^0.8.0;

import "../node_modules/@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "../node_modules/@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";

contract SimplePayment is IERC721Receiver {
    uint256 public tokenId; // no public
    address payable public seller; // no public
    address payable admin;
    bool public tokenAdded;
    ERC721  nftContract;  
    // how much the item costs
    uint256 public price; 
    // the payment by the buyer
    uint256 public payment; // no public
    uint256 public fee; // no public
    bool public paid;
    
   constructor(
        uint256 _price,
        address payable _admin
    ) payable {
        require(
            _price > 0,
            "The price has to be greater than 0."
        );
        
        seller = payable(msg.sender);
        admin = _admin;
        price = _price;
    }
    
    modifier onlySeller() {
        require(
            msg.sender == seller,
            "Only seller can call this."
        );
        _;
    }
    
    event PaymentMade(address payer, uint256 amount);
    
    function pay() public payable {
        require(
            tokenAdded == true,
            "Token has not been added yet."
        );
        
        require(
            msg.value == price,
            "Incorrect price."
        );
        
        require(
            paid == false,
            "Already paid"
        );
        
        payment = msg.value;

        fee = msg.value * 2 / 100;
        payment = msg.value - fee;
        
        nftContract.transferFrom(address(this), msg.sender, tokenId);
        
        paid = true;
        
        emit PaymentMade(msg.sender, msg.value);
    }
    
    function withdraw() public onlySeller {
        payable(msg.sender).transfer(payment);
    }
    
    function withdrawFee() public {
        require(
            admin == msg.sender,
            "Not authorized to withdraw the fee."
        );
        
        admin.transfer(fee);
    }
    
    function abort() public onlySeller {
        require(
            paid == false,
            "The item has already been purchased."
        );
        
         nftContract.transferFrom(address(this), seller, tokenId);
    }
    
    function onERC721Received(address, address, uint256 _tokenId, bytes memory) public virtual override returns (bytes4) {
        require(seller == tx.origin, "Only the seller can transfer the token into the contract.");
        require(tokenAdded == false, "The contract already has a token.");
        
        nftContract = ERC721(msg.sender);
        tokenId = _tokenId;
        tokenAdded = true;
        return this.onERC721Received.selector;
    }
}
