require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

const {ALCHEMY_API_KEY, NODE_BASE_URL} = process.env

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    // networks: {
    //   localhost: {
    //     allowUnlimitedContractSize: true
    //   }
    // },
    compilers: [
      {
        version: "0.8.10",
        settings: {
          optimizer: {
            enabled: true,
            runs: 1000,
          },
        },
      },
    ],
  },
  networks: {
    hardhat: {
      forking: {
        url: `${NODE_BASE_URL}${ALCHEMY_API_KEY}`,
        blockNumber:15815693,
        enable: true,
      }
    }
  }
};
