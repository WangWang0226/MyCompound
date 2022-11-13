
# Before Test
```
npm install --save-dev hardhat
npx hardhat

//安裝必要套件
npm install --save-dev @openzeppelin/contracts
npm install --save-dev chai
npm install dotenv

```

## Run MintAndRedeemTest
```
npx hardhat node

npx hardhat test test/MintAndRedeemTest.js --network localhost
```


## Run BorrowAndRepayBorrowTest

```
npx hardhat node

npx hardhat test test/BorrowAndRepayBorrowTest.js --network localhost
```

## Run LiquidateBorrowTest
```
npx hardhat node

npx hardhat test test/LiquidateBorrowTest.js --network localhost
```

## Run FlashLoanLiquidateTest
- Setup network environment in `hardhat.config.js`
  ```
  networks: {
      hardhat: {
        forking: {
          url: `${NODE_BASE_URL}${ALCHEMY_API_KEY}`,
          blockNumber:15815693,
          enable: true,
        }
      }
    }
  ```
- Run
  ```
  npx hardhat node

  npx hardhat test test/FlashloanLiquidateTest.js
  ```
