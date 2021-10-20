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
    mapping (address => Payment) private _simplePayment;
    
    // Maps from a tokenID to bool to indicate whether a token is currently on sale
    // This is to prevent a token to be listed for sale only one instance at a time.
    mapping (uint256 => bool) private _onSale;
    
    event PaymentMade(address buyer, uint256 amount, address id);

    constructor(
        address _admin
    ) ERC721("NFTrack", "TRK") {
        admin = payable(_admin);
    }

    function mintNft(address receiver) external returns (uint256) {
        _tokenIds.increment();

        uint256 newNftTokenId = _tokenIds.current();
        _safeMint(receiver, newNftTokenId);

        return newNftTokenId;
    }

    /**
     * @dev See {IERC721-safeTransferFrom}.
     */
    function safeTransferFrom(
        address from,
        address to,
        uint256 tokenId,
        bytes memory _data
    ) public virtual override {
        require(_isApprovedOrOwner(_msgSender(), tokenId), "ERC721: transfer caller is not owner nor approved");
        _safeTransfer(from, to, tokenId, _data);
    }
    
    function createSimplePayment(uint price, address id) public {
        _tokenIds.increment();

        uint256 newNftTokenId = _tokenIds.current();
        _mint(msg.sender, newNftTokenId);
        
        _onSale[newNftTokenId] = true;

        _simplePayment[id].price = price;
        _simplePayment[id].tokenId = newNftTokenId;
        _simplePayment[id].seller = msg.sender;
    }

    function resell(uint price, address id, uint256 tokenId) public {
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
    function pay(address id) public payable {
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
        
        emit PaymentMade(msg.sender, msg.value, id);
    }
    
    function withdraw(address id) public {
        require(
            msg.sender == _simplePayment[id].seller, "Not authorized."
        );
        
        payable(msg.sender).transfer(_simplePayment[id].payment);
    }
    
    function withdrawFee(address id) public {
        require(
            admin == msg.sender,
            "Not authorized to withdraw the fee."
        );
        
        admin.transfer(_simplePayment[id].fee);
    }

    // ONLY FOR TESTING. Delete before deploying
    function checkSimplePayment(address id) public view returns (uint, uint, uint, uint256, address) {
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
