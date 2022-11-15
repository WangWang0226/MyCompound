pragma solidity ^0.8.10;

import "./ISwapRouter.sol";
import "./TransferHelper.sol";

import "./ILendingPoolAddressesProvider.sol";
import "./ILendingPool.sol";
import "./FlashLoanReceiverBase.sol";

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20} from "./dependencies/IERC20.sol";
import {CErc20} from "./CErc20.sol";

contract WangWangFlashLoan is FlashLoanReceiverBase, Ownable {
    constructor(address _providerAddress)
        FlashLoanReceiverBase(ILendingPoolAddressesProvider(_providerAddress))
    {}

    address USDC_ADDRESS = 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48;
    address UNI_ADDRESS = 0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984;
    address UNISWAP_ROUTER_ADDRESS = 0xE592427A0AEce92De3Edee1F18E0157C05861564;

    function executeOperation(
        address[] calldata assets, //USDC
        uint256[] calldata amounts, //2500
        uint256[] calldata premiums, //flash loan interest
        address initiator,
        bytes calldata params
    ) external override returns (bool) {
        (address cUsdcAddress, address user1Address, address cUniAddress) = abi
            .decode(params, (address, address, address));

        IERC20 usdcContract = IERC20(USDC_ADDRESS);
        IERC20 uniContract = IERC20(UNI_ADDRESS);
        CErc20 cUsdcContract = CErc20(cUsdcAddress);
        CErc20 cUniContract = CErc20(cUniAddress);
        ISwapRouter swapRouter = ISwapRouter(UNISWAP_ROUTER_ADDRESS);

        uint owedAmount = amounts[0] + premiums[0];

        //approve cUsdc transfer our USDC out
        //msg.sender matters in these two function!
        usdcContract.approve(cUsdcAddress, owedAmount);
        cUsdcContract.liquidateBorrow(user1Address, amounts[0], cUniContract);

        // redeem: cUni to Uni
        cUniContract.redeem(cUniContract.balanceOf(address(this)));

        uint uniAmount = uniContract.balanceOf(address(this));

        // approve uniswap to use UNI
        uniContract.approve(UNISWAP_ROUTER_ADDRESS, uniAmount);

        ISwapRouter.ExactInputSingleParams memory swapParams = ISwapRouter
            .ExactInputSingleParams({
                tokenIn: UNI_ADDRESS,
                tokenOut: USDC_ADDRESS,
                fee: 3000, // 0.3%
                recipient: address(this),
                deadline: block.timestamp,
                amountIn: uniAmount,
                amountOutMinimum: 0,
                sqrtPriceLimitX96: 0
            });

        uint256 amountOut = swapRouter.exactInputSingle(swapParams);

        //approve lending pool can transfer out the amount we owed.
        usdcContract.approve(address(LENDING_POOL), owedAmount);

        require(amountOut > owedAmount, "we should have benefit");

        return true;
    }

    function executeFlashLoan(
        address[] calldata assets,
        uint256[] calldata amounts,
        uint256[] calldata modes,
        bytes calldata params,
        uint16 referralCode
    ) public {
        //notice: we use this contract to borrow USDC from flashLoan
        address receiverAddress = address(this);
        address onBehalfOf = address(this);

        LENDING_POOL.flashLoan(
            receiverAddress,
            assets,
            amounts,
            modes,
            onBehalfOf,
            params,
            referralCode
        );
    }
}
