const { expect } = require("chai");
const { ethers } = require("hardhat");

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

async function deployTokenA() {
    const erc20Factory = await ethers.getContractFactory("TokenA");
    const erc20 = await erc20Factory.deploy(
        ethers.utils.parseUnits("10000", 18),
        "TokenA",
        "A"
    );
    await erc20.deployed();
    return erc20;
}

async function deployTokenB() {
    const erc20Factory = await ethers.getContractFactory("TokenB");
    const erc20 = await erc20Factory.deploy(
        ethers.utils.parseUnits("10000", 18),
        "TokenB",
        "B"
    );
    await erc20.deployed();
    return erc20;
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

async function deployCToken(erc20, comptroller, interestRateModel, name, symbol, account) {
    const cerc20Factory = await ethers.getContractFactory("CErc20Immutable");
    const cerc20 = await cerc20Factory.deploy(
        erc20.address,
        comptroller.address,
        interestRateModel.address,
        ethers.utils.parseUnits("1", 18),
        name,
        symbol,
        18,
        account.address
    );
    await cerc20.deployed();
    return cerc20;
}



describe("Borrow and RepayBorrow Test", function(){

    let accounts;
    let comptroller;
    let interestRateModel;
    let oracle;
    let tokenA_contract;
    let tokenB_contract;
    let CTokenA_contract;
    let CTokenB_contract;
    let user1; //borrower
    let user2; //who deposit tokenA and also a liquidater: 
    //user2 存入 tokenA 到池子裡，讓 user1 可以借出 tokenA。
    //在 collateral factor 下降後或 tokenB 價格下降後，由 user2 來對 user1 進行清算 （user2 幫 user1 償還欠下的 tokenA）

    it("deploy and setup Cerc20", async function() {

        accounts = await ethers.getSigners();    
        user1 = accounts[1];
        user2 = accounts[2];

        comptroller = await deployComptroller();
        interestRateModel = await deployInterestRateModel();
        oracle = await deployOracle();

        tokenA_contract = await deployTokenA();
        tokenB_contract = await deployTokenB();

        CTokenA_contract = await deployCToken(tokenA_contract, comptroller, interestRateModel, "CTokenA", "CTA", accounts[0]);
        CTokenB_contract = await deployCToken(tokenB_contract, comptroller, interestRateModel, "CTokenB", "CTB", accounts[0]);

        await comptroller._setPriceOracle(oracle.address);
        await comptroller._supportMarket(CTokenA_contract.address);
        await comptroller._supportMarket(CTokenB_contract.address);
        await comptroller.connect(user1).enterMarkets([CTokenA_contract.address, CTokenB_contract.address]);
        await comptroller._setLiquidationIncentive(ethers.utils.parseUnits("1.08", 18));
        await comptroller._setCloseFactor(ethers.utils.parseUnits("0.5", 18));

        //set tokenA price to $1
        await oracle.setUnderlyingPrice(CTokenA_contract.address, ethers.utils.parseUnits("1", 18));

        //set tokenB price to $100
        await oracle.setUnderlyingPrice(CTokenB_contract.address, ethers.utils.parseUnits("100", 18));

        //set collateral factor to 50%
        await comptroller._setCollateralFactor(CTokenB_contract.address, ethers.utils.parseUnits("0.5", 18));

    })

    it("modify the collateral factor to 0.1", async function() {
        //先給 user1 1000顆 TokenB
        await tokenB_contract.transfer(user1.address,ethers.utils.parseUnits("1000", 18));

        //先給 user2 2000顆 TokenA
        await tokenA_contract.transfer(user2.address,ethers.utils.parseUnits("2000", 18));

        //user2 存 100 顆 TokenA 進去池子，並取得 100 顆 CTokenA。池子有錢之後，待會才能借出 50 tokenA 給 user1
        console.log("user2 mint 100 CTokenA...");
        await tokenA_contract.connect(user2).approve(CTokenA_contract.address, ethers.utils.parseUnits("100", 18));
        await CTokenA_contract.connect(user2).mint(ethers.utils.parseUnits("100", 18));
        console.log("user2's tokenA balance:", ethers.utils.formatUnits(await tokenA_contract.balanceOf(user2.address), 18));
        console.log("user2's CTokenA balance:", ethers.utils.formatUnits(await CTokenA_contract.balanceOf(user2.address), 18));
        console.log("CTokenA's tokenA balance:", ethers.utils.formatUnits(await tokenA_contract.balanceOf(CTokenA_contract.address), 18));
        console.log("--------------------------------------------------------------------");

        console.log("user1 mint 1 CTokenB...");
        //user1 存 1 顆 TokenB 進去，並取得 1 顆 CTokenB
        await tokenB_contract.connect(user1).approve(CTokenB_contract.address, ethers.utils.parseUnits("1", 18));
        await CTokenB_contract.connect(user1).mint(ethers.utils.parseUnits("1", 18));
        console.log("user1's tokenA balance:", ethers.utils.formatUnits(await tokenA_contract.balanceOf(user1.address), 18));
        console.log("user1's CTokenA balance:", ethers.utils.formatUnits(await CTokenA_contract.balanceOf(user1.address), 18));
        console.log("user1's tokenB balance:", ethers.utils.formatUnits(await tokenB_contract.balanceOf(user1.address), 18));
        console.log("user1's CTokenB balance:", ethers.utils.formatUnits(await CTokenB_contract.balanceOf(user1.address), 18));
        console.log("--------------------------------------------------------------------");

        //user1 借出 50 顆 tokenA
        console.log("user1 borrow 50 tokenA...");
        await CTokenA_contract.connect(user1).borrow(ethers.utils.parseUnits("50", 18))
        console.log("user1's tokenA balance:", ethers.utils.formatUnits(await tokenA_contract.balanceOf(user1.address), 18));
        console.log("user1's CTokenA balance:", ethers.utils.formatUnits(await CTokenA_contract.balanceOf(user1.address), 18));
        console.log("user1's tokenB balance:", ethers.utils.formatUnits(await tokenB_contract.balanceOf(user1.address), 18));
        console.log("user1's CTokenB balance:", ethers.utils.formatUnits(await CTokenB_contract.balanceOf(user1.address), 18));
        console.log("CTokenA's tokenA balance:", ethers.utils.formatUnits(await tokenA_contract.balanceOf(CTokenA_contract.address), 18));
        console.log("--------------------------------------------------------------------");

        await comptroller._setCollateralFactor(CTokenB_contract.address, ethers.utils.parseUnits("0.1", 18));

        await CTokenA_contract.connect(user2).liquidateBorrow(user1.address, ethers.utils.parseUnits("25", 18), CTokenB_contract.address);

        console.log("user1's tokenA balance:", ethers.utils.formatUnits(await tokenA_contract.balanceOf(user1.address), 18));
        console.log("user1's CTokenA balance:", ethers.utils.formatUnits(await CTokenA_contract.balanceOf(user1.address), 18));
        console.log("user1's tokenB balance:", ethers.utils.formatUnits(await tokenB_contract.balanceOf(user1.address), 18));
        console.log("user1's CTokenB balance:", ethers.utils.formatUnits(await CTokenB_contract.balanceOf(user1.address), 18));
        console.log("--------------------------------------------------------------------");
        console.log("user2's tokenA balance:", ethers.utils.formatUnits(await tokenA_contract.balanceOf(user2.address), 18));
        console.log("user2's CTokenA balance:", ethers.utils.formatUnits(await CTokenA_contract.balanceOf(user2.address), 18));
        console.log("user2's tokenB balance:", ethers.utils.formatUnits(await tokenB_contract.balanceOf(user2.address), 18));
        console.log("user2's CTokenB balance:", ethers.utils.formatUnits(await CTokenB_contract.balanceOf(user2.address), 18));

    })


})