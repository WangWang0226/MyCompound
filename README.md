
# Before Test
```
npm install --save-dev hardhat
npx hardhat

//安裝必要套件
npm install --save-dev @openzeppelin/contracts

//建立本地節點
npx hardhat node
```

## Run MintAndRedeemTest
```
npx hardhat test test/MintAndRedeemTest.js --network localhost
```


## Run BorrowAndRepayBorrowTest

```
npx hardhat test test/BorrowAndRepayBorrowTest.js --network localhost
```

## Run LiquidateBorrowTest
```
npx hardhat test test/LiquidateBorrowTest.js --network localhost
```

