// SPDX-License-Identifier: BSD-3-Clause
pragma solidity ^0.8.10;
import "./InterestRateModel.sol";
/**
  * @title Compound's InterestRateModel Interface
  * @author Compound
  */
contract WangWangInterestRateModel is InterestRateModel{

    uint public _borrowRate;
    uint _supplyRate;

    constructor(uint borrowRate_, uint supplyRate_){
        _borrowRate = borrowRate_;
        _supplyRate = supplyRate_;
    }

    /**
      * @notice Calculates the current borrow interest rate per block
      * @param cash The total amount of cash the market has
      * @param borrows The total amount of borrows the market has outstanding
      * @param reserves The total amount of reserves the market has
      * @return The borrow rate per block (as a percentage, and scaled by 1e18)
      */
    function getBorrowRate(uint cash, uint borrows, uint reserves) external view override returns (uint) {
        return _borrowRate;
    }

    /**
      * @notice Calculates the current supply interest rate per block
      * @param cash The total amount of cash the market has
      * @param borrows The total amount of borrows the market has outstanding
      * @param reserves The total amount of reserves the market has
      * @param reserveFactorMantissa The current reserve factor the market has
      * @return The supply rate per block (as a percentage, and scaled by 1e18)
      */
    function getSupplyRate(uint cash, uint borrows, uint reserves, uint reserveFactorMantissa) external view override returns (uint) {
        return _supplyRate;
    }
}