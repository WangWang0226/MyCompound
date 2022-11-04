const { expect } = require("chai");
const { ethers } = require("hardhat");

async function deployComptroller() {
    const comptrollerFactory = await ethers.getContractFactory("Comptroller");
    const comptroller = await comptrollerFactory.deploy()
    await comptroller.deployed();
    console.log("Comptroller has been deployed!")
    return comptroller
}

async function deployOracle() {
    const oracleFactory = await ethers.getContractFactory("SimplePriceOracle");
    const oracle = await oracleFactory.deploy()
    await oracle.deployed();
    console.log("Oracle has been deployed!")
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
    console.log("TokenA has been deployed!")
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
    console.log("TokenB has been deployed!")
    return erc20;
}

async function deployInterestRateModel() {
    const interestRateModelFactory = await ethers.getContractFactory("WangWangInterestRateModel");
    const interestRateModel = await interestRateModelFactory.deploy(
        ethers.utils.parseUnits("0", 18),
        ethers.utils.parseUnits("0", 18)
    );
    await interestRateModel.deployed();
    console.log("InterestRateModel has been deployed!")
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
    console.log("CToken has been deployed!")
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
    let user1;
    let userRich;

    it("deploy and setup Cerc20", async function() {

        accounts = await ethers.getSigners();    
        comptroller = await deployComptroller();
        interestRateModel = await deployInterestRateModel();
        oracle = await deployOracle();

        tokenA_contract = await deployTokenA();
        tokenB_contract = await deployTokenB();

        //comptroller, interestRateModel, oracle 可共用
        CTokenA_contract = await deployCToken(tokenA_contract, comptroller, interestRateModel, "CTokenA", "CTA", accounts[0]);
        CTokenB_contract = await deployCToken(tokenB_contract, comptroller, interestRateModel, "CTokenB", "CTB", accounts[0]);

        await comptroller._setPriceOracle(oracle.address);

        //將 cToken 加入 markets list 裡面，若不加入會發生 error MintComptrollerRejection
        await comptroller._supportMarket(CTokenA_contract.address);
        await comptroller._supportMarket(CTokenB_contract.address);
        //將 cToken 加入可抵押列表
        await comptroller.enterMarkets([CTokenA_contract.address, CTokenB_contract.address]);

        //set tokenA price to $1
        await oracle.setUnderlyingPrice(CTokenA_contract.address, ethers.utils.parseUnits("1", 18));

        //set tokenB price to $100
        await oracle.setUnderlyingPrice(CTokenB_contract.address, ethers.utils.parseUnits("100", 18));

        //set collateral factor to 50%
        await comptroller._setCollateralFactor(CTokenB_contract.address, ethers.utils.parseUnits("0.5", 18));

    })

    it("borrow should be ok", async function() {
        //先給 user1 1000顆 TokenB
        user1 = accounts[1];
        await tokenB_contract.transfer(
            user1.address,
            ethers.utils.parseUnits("1000", 18)
        );
        console.log("transfer 1000 tokenB to user1...");
        console.log("user1 tokenB blance is:", ethers.utils.formatUnits(await tokenB_contract.balanceOf(user1.address), 18));

        //先給 userRich 2000顆 TokenA
        userRich = accounts[2];
        await tokenA_contract.transfer(
            userRich.address,
            ethers.utils.parseUnits("2000", 18)
        );
        console.log("transfer 2000 tokenA to userRich...");
        console.log("userRich tokenA blance is:", ethers.utils.formatUnits(await tokenA_contract.balanceOf(userRich.address), 18));


        //userRich 存 100 顆 TokenA 進去，並取得 100 顆 CTokenA
        await tokenA_contract.connect(userRich).approve(CTokenA_contract.address, ethers.utils.parseUnits("100", 18));
        await CTokenA_contract.connect(userRich).mint(ethers.utils.parseUnits("100", 18));
        console.log("userRich tokenA balance is:", ethers.utils.formatUnits(await tokenA_contract.balanceOf(userRich.address), 18));
        console.log("userRich CTokenA balance is:", ethers.utils.formatUnits(await CTokenA_contract.balanceOf(userRich.address), 18));

        console.log("mint..");
        //user1 存 1 顆 TokenB 進去，並取得 1 顆 CTokenB
        await tokenB_contract.connect(user1).approve(CTokenB_contract.address, ethers.utils.parseUnits("1", 18));
        await CTokenB_contract.connect(user1).mint(ethers.utils.parseUnits("1", 18));
        console.log("user1 tokenA blance is:", ethers.utils.formatUnits(await tokenA_contract.balanceOf(user1.address), 18));
        console.log("user1 tokenB blance is:", ethers.utils.formatUnits(await tokenB_contract.balanceOf(user1.address), 18));
        console.log("user1 CTokenB blance is:", ethers.utils.formatUnits(await CTokenB_contract.balanceOf(user1.address), 18));

        //user1 抵押品為 1 顆 TokenB($100)，collateral factor 為 50%，表示可借出 $50 等值的 tokenA($1)，也就是 50 顆 tokenA
        await CTokenA_contract.connect(user1).borrow(ethers.utils.parseUnits("50", 18))
        console.log("user1 tokenA blance is:", ethers.utils.formatUnits(await tokenA_contract.balanceOf(user1.address), 18));
        console.log("user1 tokenB blance is:", ethers.utils.formatUnits(await tokenB_contract.balanceOf(user1.address), 18));
        console.log("user1 CTokenB blance is:", ethers.utils.formatUnits(await CTokenB_contract.balanceOf(user1.address), 18));

    })

})