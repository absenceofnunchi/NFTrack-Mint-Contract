// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../node_modules/@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "../node_modules/@openzeppelin/contracts/utils/Counters.sol";

contract NFTrack is ERC721 {
    using Counters for Counters.Counter;
    Counters.Counter private _tokenIds;
    address payable private admin; 

    struct Payment {
        uint payment;
        uint price;
        uint fee;
        uint256 tokenId;
        address seller;
    }
    
    // Maps from a item ID to Payment
    mapping (string => Payment) private _simplePayment;
    
    // Maps from a tokenID to bool to indicate whether a token is currently on sale
    // This is to prevent a token to be listed for sale only one instance at a time.
    mapping (uint256 => bool) private _onSale;
    
    event PaymentMade(string id);

    constructor() ERC721("NFTrack", "TRK") {
        admin = payable(msg.sender);
    }

    function mintNft(address receiver) external returns (uint256) {
        _tokenIds.increment();

        uint256 newNftTokenId = _tokenIds.current();
        _safeMint(receiver, newNftTokenId);

        return newNftTokenId;
    }
    
    function createSimplePayment(uint price, string memory id) public {
        _tokenIds.increment();

        uint256 newNftTokenId = _tokenIds.current();
        _mint(msg.sender, newNftTokenId);
        
        _onSale[newNftTokenId] = true;

        _simplePayment[id].price = price;
        _simplePayment[id].tokenId = newNftTokenId;
        _simplePayment[id].seller = msg.sender;
    }

    function resell(uint price, string memory id, uint256 tokenId) public {
        require(  
            _onSale[tokenId] == false,
            "The token is already listed for sale."
        );

        require(
            price > 0,
            "The price has to be greater than 0"
        );

        require(
            msg.sender == ownerOf(tokenId),
            "You are not the owner of the token."
        );

        _onSale[tokenId] = true;
        _simplePayment[id].price = price;
        _simplePayment[id].tokenId = tokenId;
        _simplePayment[id].seller = msg.sender;
    }
    
    // id is the posting identifier
    function pay(string memory id) public payable {
        require(
            _simplePayment[id].price > 0,
            "Not for sale."
        );

        require(
            msg.value == _simplePayment[id].price,
            "Incorrect price."
        );   
        
        // make a payment for the seller to withdraw
        uint _fee = msg.value * 2 / 100;
        _simplePayment[id].payment = msg.value - _fee;
        _simplePayment[id].fee = _fee;
        
        // transfer the token
        uint256 tokenId = _simplePayment[id].tokenId;
        address owner = ERC721.ownerOf(tokenId);
        _transfer(owner, msg.sender, tokenId);
        _simplePayment[id].price = 0; // not for sale anymore
        _onSale[tokenId] = false;
        
        emit PaymentMade(id);
    }
    
    function withdraw(string memory id) public {
        require(
            msg.sender == _simplePayment[id].seller, "Not authorized."
        );
        
        payable(msg.sender).transfer(_simplePayment[id].payment);
    }
    
    function withdrawFee(string memory id) public {
        require(
            admin == msg.sender,
            "Not authorized to withdraw the fee."
        );
        
        admin.transfer(_simplePayment[id].fee);
    }
    
    function getInfo(uint256 tokenId, string memory id) public view returns (bool, uint, uint256) {
        return (_onSale[tokenId], _simplePayment[id].price, _simplePayment[id].tokenId);
    }

    // ONLY FOR TESTING. Delete before deploying
    function checkSimplePayment(string memory id) public view returns (uint, uint, uint, uint256, address) {
        Payment memory payment = _simplePayment[id];
        return (payment.payment, payment.price, payment.fee, payment.tokenId, payment.seller);
    }

    function checkAdmin() public view returns (address) {
        return admin;
    }

    function checkOnSale(uint256 tokenId) public view returns (bool) {
        return _onSale[tokenId];
    }
}
