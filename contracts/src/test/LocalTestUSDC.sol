// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/**
 * @title LocalTestUSDC
 * @notice LOCAL TESTING ONLY. A minimal 6-decimal ERC-20 used on the local Hardhat chain (31337)
 *         so CI can exercise real Transfer logs deterministically. Never deploy to a public network:
 *         on Sepolia, HashX settles exclusively in Circle's official test USDC.
 */
contract LocalTestUSDC {
    string public constant name = "Local Test USDC (no value)";
    string public constant symbol = "USDC";
    uint8 public constant decimals = 6;
    uint256 public totalSupply;
    address public immutable minter;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    error NotMinter();
    error InsufficientBalance();
    error InsufficientAllowance();

    constructor() {
        minter = msg.sender;
    }

    function mint(address to, uint256 amount) external {
        if (msg.sender != minter) revert NotMinter();
        totalSupply += amount;
        balanceOf[to] += amount;
        emit Transfer(address(0), to, amount);
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        _move(msg.sender, to, amount);
        return true;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        uint256 a = allowance[from][msg.sender];
        if (a < amount) revert InsufficientAllowance();
        allowance[from][msg.sender] = a - amount;
        _move(from, to, amount);
        return true;
    }

    function _move(address from, address to, uint256 amount) private {
        uint256 b = balanceOf[from];
        if (b < amount) revert InsufficientBalance();
        balanceOf[from] = b - amount;
        balanceOf[to] += amount;
        emit Transfer(from, to, amount);
    }
}
