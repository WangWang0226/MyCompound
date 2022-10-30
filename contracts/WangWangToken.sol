// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.9;
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "hardhat/console.sol";

contract WangWangToken is ERC20 {

    event LogTotalSupply(string message, uint totalSupply);
    event LogBalanceOf(address addr, uint balance);

    constructor(uint _initialSupply, string memory _name, string memory _symbol) ERC20(_name, _symbol) {
        _mint(msg.sender, _initialSupply);
        console.log("totalSupply is %s", ERC20.totalSupply());
    }

    function totalSupply() public view override returns (uint256) {
        uint tts = ERC20.totalSupply();
        console.log("totalSupply is %s", tts);
        return tts;
    }

    function balanceOf(address account) public view override returns (uint256) {
        uint balance = ERC20.balanceOf(account);
        console.log("balance of %s is %s", account, balance);
        return balance;
    }
}

