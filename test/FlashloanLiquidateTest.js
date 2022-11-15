const { impersonateAccount } = require("@nomicfoundation/hardhat-network-helpers");
// const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");
const { expect } = require("chai");
const erc20_abi = require("../abi/ERC20_ABI.json");
const { ethers } = require("hardhat");

/*
* 角色：
* 借款者：user1
* 清算者：user2
* USDC 流動性提供者：Binance

* 環境設定：
* cToken 的 decimals 皆為 18，初始 exchangeRate 為 1:1
* 使用 USDC 以及 UNI 代幣來作為 token A 以及 Token B
* 在 Oracle 中設定 USDC 的價格為 $1，UNI 的價格為 $10
* 設定 UNI 的 collateral factor 為 50%
* 取得 Binance 錢包權限，存 USDC 進 cUSDC
* 給 user1 足夠的 UNI


* 步驟：
* user1 抵押 1000 顆 UNI 借出 5000 顆 USDC
* 將 UNI 價格改為 $6.2 使 User1 產生 Shortfall
* user2 跟 AAVE 閃電貸借 USDC，幫 user1 清算(還款)，拿到 user1 的抵押品(cUNI)後，領出 UNI
* 把 UNI 換成 USDC，再把這些錢拿去償還閃電貸
*
*/

async function deployComptroller() {
    const comptrollerFactory = await ethers.getContractFactory("Comptroller");
    const comptroller = await comptrollerFactory.deploy()
    await comptroller.deployed();
    return comptroller
}

async function deployOracle() {
    const oracleFactory = await ethers.getContractFactory("SimplePriceOracle");
    const oracle = await oracleFactory.deploy()
    await oracle.deployed();
    return oracle
}

async function deployInterestRateModel() {
    const interestRateModelFactory = await ethers.getContractFactory("WangWangInterestRateModel");
    const interestRateModel = await interestRateModelFactory.deploy(
        ethers.utils.parseUnits("0", 18),
        ethers.utils.parseUnits("0", 18)
    );
    await interestRateModel.deployed();
    return interestRateModel;
}

async function deployCToken(erc20, comptroller, interestRateModel, exchangeRate, name, symbol, account) {
    const cerc20Factory = await ethers.getContractFactory("CErc20Immutable");
    const cerc20 = await cerc20Factory.deploy(
        erc20.address,
        comptroller.address,
        interestRateModel.address,
        exchangeRate,
        name,
        symbol,
        18,
        account.address
    );
    await cerc20.deployed();
    return cerc20;
}

async function deployAaveLendingPool(lendingPoolProviderAdress) {

    const factory = await ethers.getContractFactory("WangWangFlashLoan");
    const flashLoan = await factory.deploy(lendingPoolProviderAdress);
    await flashLoan.deployed();
    return flashLoan
}

describe("Q6 Test", function () {
    const BINANCE_WALLET_ADDRESS = '0xF977814e90dA44bFA03b6295A0616a897441aceC'
    const AAVE_LENDING_POOL_ADDRESS = '0x7d2768dE32b0b80b7a3454c06BdAc94A69DDc7A9'
    const AAVE_LENDING_POOL_PROVIDER_ADDRESS = '0xB53C1a33016B2DC2fF3653530bfF1848a515c8c5'
    const USDC_ADDRESS = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
    const UNI_ADDRESS = '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984'

    
    let user1;
    let user2;
    let usdcContract;
    let uniContract;
    let cUsdcContract;
    let cUniContract;
    let comptroller;
    let interestRateModel;
    let oracle;
    let aaveLendingPool;
    let flashLoan;
    
    before(async function () {

        /* <------- Deploy cToken contracts ------->*/
        const accounts = await ethers.getSigners();
        user1 = accounts[1]
        user2 = accounts[2]

        usdcContract = await ethers.getContractAt(erc20_abi, USDC_ADDRESS);
        console.log("Binance wallet USDC balance:", ethers.utils.formatUnits(await usdcContract.balanceOf(BINANCE_WALLET_ADDRESS), 6))

        uniContract = await ethers.getContractAt(erc20_abi, UNI_ADDRESS);
        console.log("Binance wallet UNI balance:", ethers.utils.formatUnits(await uniContract.balanceOf(BINANCE_WALLET_ADDRESS), 18))


        comptroller = await deployComptroller();
        interestRateModel = await deployInterestRateModel();
        oracle = await deployOracle();

        cUsdcContract = await deployCToken(usdcContract, comptroller, interestRateModel, ethers.utils.parseUnits("1", 6), "CUsdcToken", "CUSDC", accounts[0]);
        cUniContract = await deployCToken(uniContract, comptroller, interestRateModel, ethers.utils.parseUnits("1", 18), "CUniToken", "CUNI", accounts[0]);

        /* <------- deploy Aave related contract ------->*/
        flashLoan = await deployAaveLendingPool(AAVE_LENDING_POOL_PROVIDER_ADDRESS);
        aaveLendingPool = await ethers.getContractAt("ILendingPool", AAVE_LENDING_POOL_ADDRESS);
        
        /* <------- Set market environment ------->*/
        await comptroller._setPriceOracle(oracle.address);
        await comptroller._supportMarket(cUsdcContract.address);
        await comptroller._supportMarket(cUniContract.address);
        await comptroller.connect(user1).enterMarkets([cUsdcContract.address, cUniContract.address]);
        
        await oracle.setUnderlyingPrice(cUsdcContract.address, ethers.utils.parseUnits("1", 30));
        await oracle.setUnderlyingPrice(cUniContract.address, ethers.utils.parseUnits("10", 18));

        await comptroller._setCollateralFactor(cUniContract.address, ethers.utils.parseUnits("0.5", 18));
        await comptroller._setLiquidationIncentive(ethers.utils.parseUnits("1.08", 18));
        await comptroller._setCloseFactor(ethers.utils.parseUnits("0.5", 18));

        /* <------- Give money to pool and user -------> */
        await impersonateAccount(BINANCE_WALLET_ADDRESS)
        const binanceWallet = await ethers.getSigner(BINANCE_WALLET_ADDRESS);

        //Give user1 1000 UNI
        const amount = ethers.utils.parseUnits("1000", 18)
        await uniContract.connect(binanceWallet).transfer(user1.address, amount);
        const user1UniBalance = await uniContract.balanceOf(user1.address);
        expect(user1UniBalance).to.eq(amount) 

        //Deposit 12000 USDC into cUSDC pool
        const depositAmount = ethers.utils.parseUnits("12000", 6)
        await usdcContract.connect(binanceWallet).approve(cUsdcContract.address, depositAmount);
        await cUsdcContract.connect(binanceWallet).mint(depositAmount);

        const UsdcBalanceOfcUsdcPool = await usdcContract.balanceOf(cUsdcContract.address);
        expect(UsdcBalanceOfcUsdcPool).to.eq(depositAmount) 
        const cUsdcBalanceOfBinanceWallet = await cUsdcContract.balanceOf(binanceWallet.address);
        expect(cUsdcBalanceOfBinanceWallet).to.eq(ethers.utils.parseUnits("12000", 18))

    });

    it("user1 抵押 1000 顆 UNI 借出 5000 顆 USDC", async function () {
        //user1 deposit 1000 UNI into cUNI pool, and get 1000 cUni
        const depositAmount = ethers.utils.parseUnits("1000", 18)

        await uniContract.connect(user1).approve(cUniContract.address, depositAmount);
        await cUniContract.connect(user1).mint(depositAmount);
        const cUniPoolBalance = await uniContract.balanceOf(cUniContract.address);
        expect(cUniPoolBalance).to.eq(depositAmount) 

        
        //user1 以池子中的 1000 顆 UNI 作為抵押，借出 5000 顆 USDC
        await cUsdcContract.connect(user1).borrow(ethers.utils.parseUnits("5000", 6));
        const cUsdcPoolBalance = await usdcContract.balanceOf(cUsdcContract.address);
        expect(cUsdcPoolBalance).to.eq(ethers.utils.parseUnits("7000", 6)) 
    })

    it("將 UNI 價格改為 $6.2 使 User1 產生 Shortfall", async function() {
        await oracle.setUnderlyingPrice(cUniContract.address, ethers.utils.parseUnits("6.2", 18));
        const price = await oracle.getUnderlyingPrice(cUniContract.address);
        expect(price).to.equal(ethers.utils.parseUnits("6.2", 18));
    })

    it("user2 跟 AAVE 閃電貸借 2500 USDC，幫 user1 清算(還款)，拿到 user1 的抵押品(cUNI)後，領出 UNI 並換回 USDC 來償還 FlashLoan", async function() {
        const abiCoder = new ethers.utils.AbiCoder()
        const params = abiCoder.encode( 
          ['address', 'address', 'address'],
          [cUsdcContract.address, user1.address, cUniContract.address]
        )

        flashLoan.executeFlashLoan(
            [usdcContract.address],
            [ethers.utils.parseUnits("2500", 6)],
            [0],
            params,
            [0]
        )

        // flashloan profit > 0
        expect(await usdcContract.balanceOf(flashLoan.address))
        .to.above(ethers.utils.parseUnits("0", 6))

    })


});
