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

    before(async function() {

        accounts = await ethers.getSigners();    
        user1 = accounts[1];
        userRich = accounts[2];

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
        await comptroller.connect(user1).enterMarkets([CTokenA_contract.address, CTokenB_contract.address]);

        //set tokenA price to $1
        await oracle.setUnderlyingPrice(CTokenA_contract.address, ethers.utils.parseUnits("1", 18));

        //set tokenB price to $100
        await oracle.setUnderlyingPrice(CTokenB_contract.address, ethers.utils.parseUnits("100", 18));

        //set collateral factor to 50%
        await comptroller._setCollateralFactor(CTokenB_contract.address, ethers.utils.parseUnits("0.5", 18));

    })

    it("Borrow should be ok", async function() {
        //先給 user1 1000顆 TokenB
        await tokenB_contract.transfer(
            user1.address,
            ethers.utils.parseUnits("1000", 18)
        );
        console.log("transfer 1000 tokenB to user1...");
        console.log("user1's tokenB balance:", ethers.utils.formatUnits(await tokenB_contract.balanceOf(user1.address), 18));
        console.log("--------------------------------------------------------------------");

        //先給 userRich 2000顆 TokenA
        await tokenA_contract.transfer(
            userRich.address,
            ethers.utils.parseUnits("2000", 18)
        );
        console.log("transfer 2000 tokenA to userRich...");
        console.log("userRich's tokenA balance:", ethers.utils.formatUnits(await tokenA_contract.balanceOf(userRich.address), 18));
        console.log("--------------------------------------------------------------------");


        //userRich 存 100 顆 TokenA 進去池子，並取得 100 顆 CTokenA。池子有錢之後，待會才能借出 50 tokenA 給 user1
        console.log("userRich mint 100 CTokenA...");
        await tokenA_contract.connect(userRich).approve(CTokenA_contract.address, ethers.utils.parseUnits("100", 18));
        await CTokenA_contract.connect(userRich).mint(ethers.utils.parseUnits("100", 18));
        console.log("userRich's tokenA balance:", ethers.utils.formatUnits(await tokenA_contract.balanceOf(userRich.address), 18));
        console.log("userRich's CTokenA balance:", ethers.utils.formatUnits(await CTokenA_contract.balanceOf(userRich.address), 18));
        console.log("CTokenA's tokenA balance:", ethers.utils.formatUnits(await tokenA_contract.balanceOf(CTokenA_contract.address), 18));
        console.log("--------------------------------------------------------------------");

        console.log("user1 mint 1 CTokenB...");
        //user1 存 1 顆 TokenB 進去，並取得 1 顆 CTokenB
        await tokenB_contract.connect(user1).approve(CTokenB_contract.address, ethers.utils.parseUnits("1", 18));
        await CTokenB_contract.connect(user1).mint(ethers.utils.parseUnits("1", 18));
        console.log("user1's tokenA blance:", ethers.utils.formatUnits(await tokenA_contract.balanceOf(user1.address), 18));
        console.log("user1's tokenB blance:", ethers.utils.formatUnits(await tokenB_contract.balanceOf(user1.address), 18));
        console.log("user1's CTokenB blance:", ethers.utils.formatUnits(await CTokenB_contract.balanceOf(user1.address), 18));
        console.log("--------------------------------------------------------------------");

        //user1 抵押品為 1 顆 TokenB($100)，collateral factor 為 50%，表示可借出 $50 等值的 tokenA($1)，也就是 50 顆 tokenA
        console.log("user1 borrow 50 tokenA...");
        await CTokenA_contract.connect(user1).borrow(ethers.utils.parseUnits("50", 18))
        console.log("user1's tokenA balance:", ethers.utils.formatUnits(await tokenA_contract.balanceOf(user1.address), 18));
        console.log("CTokenA's tokenA balance:", ethers.utils.formatUnits(await tokenA_contract.balanceOf(CTokenA_contract.address), 18));
        console.log("--------------------------------------------------------------------");

    })

    it("RepayBorrow should be ok", async function() {
        //user1 aprrove CTokenA contract 去轉移他的 tokenA 餘額
        console.log("user1 repayBorrow 50 tokenA...");
        await tokenA_contract.connect(user1).approve(CTokenA_contract.address, ethers.utils.parseUnits("50", 18));
        await CTokenA_contract.connect(user1).repayBorrow(ethers.utils.parseUnits("50", 18));
        console.log("user1's tokenA balance:", ethers.utils.formatUnits(await tokenA_contract.balanceOf(user1.address), 18));
        console.log("CTokenA's tokenA balance:", ethers.utils.formatUnits(await tokenA_contract.balanceOf(CTokenA_contract.address), 18));
        console.log("--------------------------------------------------------------------");
    })

    

})