const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("CERC20", function(){
    var accounts
    var comptroller
    var erc20
    var interestRateModel
    var cerc20
    it("deploy comptroller", async function() {
        const comptrollerFactory = await ethers.getContractFactory("Comptroller");
        comptroller = await comptrollerFactory.deploy()
        await comptroller.deployed();
        comptroller._setPriceOracle("SimplePriceOracle");
        console.log("comptroller has been deployed!")
    }),

    it("deploy WangWangToken", async function() {
        const erc20Factory = await ethers.getContractFactory("WangWangToken");
        erc20 = await erc20Factory.deploy(
            ethers.utils.parseUnits("10000", 18),
            "WangWangToken",
            "WWT"
        );
        await erc20.deployed();
        await erc20.totalSupply();
        console.log("WangWangToken has been deployed!")
    }),
    it("deploy WangWangInterestRateModel", async function() {
        const interestRateModelFactory = await ethers.getContractFactory("WangWangInterestRateModel");
        interestRateModel = await interestRateModelFactory.deploy(
            ethers.utils.parseUnits("0", 18),
            ethers.utils.parseUnits("0", 18)
        );
        await interestRateModel.deployed();
        console.log("InterestRateModel has been deployed!")
    }),

    it("deploy CERC20", async function() {
        accounts = await ethers.getSigners(); 
        const cerc20Factory = await ethers.getContractFactory("CErc20Immutable");
        cerc20 = await cerc20Factory.deploy(
            erc20.address,
            comptroller.address,
            interestRateModel.address,
            ethers.utils.parseUnits("1", 18),
            "WangWangCToken",
            "WWCT",
            18,
            accounts[0].address
        );
        await cerc20.deployed();
        console.log("Cerc20 has been deployed!")
    })

    //User1 使用 100 顆（100 * 10^18） ERC20 去 mint 出 100 CErc20 token，
    //再用 100 CErc20 token redeem 回 100 顆 ERC20
    it("Should be able to mint/redeem with token A", async function() {
        
        //先給 user1 1000顆 WangWangToken
        const user1 = accounts[1];
        await erc20.transfer(
            user1.address,
            ethers.utils.parseUnits("1000", 18)
        );
        logErc20UserBalance();
        expect(await erc20.balanceOf(user1.address)).to.equal(ethers.utils.parseUnits("1000", 18));
        
        //minter 要 approve cerc20 合約去 transfer 他的 erc20 代幣資產
        await erc20.connect(user1).approve(cerc20.address, ethers.utils.parseUnits("100", 18));
 
        //必須將 cerc20 加入 markets list 裡面，若不加入會發生 error MintComptrollerRejection
        await comptroller._supportMarket(cerc20.address);

        //user1 存款 100顆 WangWangToken 進去，並取得 100顆 cerc20 token
        await cerc20.connect(user1).mint(ethers.utils.parseUnits("100", 18));

        console.log("deposit is done");
        expect(await erc20.balanceOf(user1.address)).to.equal(ethers.utils.parseUnits("900", 18));
        expect(await cerc20.balanceOf(user1.address)).to.equal(ethers.utils.parseUnits("100", 18));
        logErc20UserBalance();
        logCErc20UserBalance();

        //user1 拿 100顆 cerc20 token，換回並提領 100顆 WangWangToken 出來
        await cerc20.connect(user1).redeem(ethers.utils.parseUnits("100", 18));

        console.log("redeem is done");
        expect(await erc20.balanceOf(user1.address)).to.equal(ethers.utils.parseUnits("1000", 18));
        expect(await cerc20.balanceOf(user1.address)).to.equal(ethers.utils.parseUnits("0", 18));
        logErc20UserBalance();
        logCErc20UserBalance();

        async function logErc20UserBalance() {
            console.log(
                user1.address,
                "has",
                ethers.utils.formatUnits(await erc20.balanceOf(user1.address), 18),
                "WangWang token"
            );
        }

        async function logCErc20UserBalance() {
            console.log(
                user1.address,
                "has",
                ethers.utils.formatUnits(await cerc20.balanceOf(user1.address), 18),
                "cerc20 token"
            );
        }
    })

})