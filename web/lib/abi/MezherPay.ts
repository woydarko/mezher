// Generated from contracts/out/MezherPay.sol/MezherPay.json (forge build). Regenerate after contract changes.
export const mezherPayAbi = [
  {
    "type": "constructor",
    "inputs": [
      {
        "name": "musd_",
        "type": "address",
        "internalType": "contract IERC20"
      },
      {
        "name": "bos_",
        "type": "address",
        "internalType": "contract IBorrowerOperationsSignatures"
      },
      {
        "name": "troveManager_",
        "type": "address",
        "internalType": "contract ITroveManager"
      },
      {
        "name": "priceFeed_",
        "type": "address",
        "internalType": "contract IPriceFeed"
      }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "MIN_ICR_AFTER",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "bos",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "contract IBorrowerOperationsSignatures"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "musd",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "contract IERC20"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "pay",
    "inputs": [
      {
        "name": "p",
        "type": "tuple",
        "internalType": "struct MezherPay.Payment",
        "components": [
          {
            "name": "payer",
            "type": "address",
            "internalType": "address"
          },
          {
            "name": "merchant",
            "type": "address",
            "internalType": "address"
          },
          {
            "name": "amount",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "fromBalance",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "orderId",
            "type": "bytes32",
            "internalType": "bytes32"
          }
        ]
      },
      {
        "name": "permit",
        "type": "tuple",
        "internalType": "struct MezherPay.PermitSig",
        "components": [
          {
            "name": "deadline",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "v",
            "type": "uint8",
            "internalType": "uint8"
          },
          {
            "name": "r",
            "type": "bytes32",
            "internalType": "bytes32"
          },
          {
            "name": "s",
            "type": "bytes32",
            "internalType": "bytes32"
          }
        ]
      },
      {
        "name": "borrow",
        "type": "tuple",
        "internalType": "struct MezherPay.BorrowSig",
        "components": [
          {
            "name": "upperHint",
            "type": "address",
            "internalType": "address"
          },
          {
            "name": "lowerHint",
            "type": "address",
            "internalType": "address"
          },
          {
            "name": "deadline",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "signature",
            "type": "bytes",
            "internalType": "bytes"
          }
        ]
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "priceFeed",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "contract IPriceFeed"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "troveManager",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "contract ITroveManager"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "event",
    "name": "Paid",
    "inputs": [
      {
        "name": "orderId",
        "type": "bytes32",
        "indexed": true,
        "internalType": "bytes32"
      },
      {
        "name": "payer",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "merchant",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "amount",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      },
      {
        "name": "fromBalance",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      },
      {
        "name": "borrowed",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      }
    ],
    "anonymous": false
  },
  {
    "type": "error",
    "name": "FromBalanceExceedsAmount",
    "inputs": []
  },
  {
    "type": "error",
    "name": "IcrBelowFloor",
    "inputs": [
      {
        "name": "icr",
        "type": "uint256",
        "internalType": "uint256"
      }
    ]
  },
  {
    "type": "error",
    "name": "SafeERC20FailedOperation",
    "inputs": [
      {
        "name": "token",
        "type": "address",
        "internalType": "address"
      }
    ]
  },
  {
    "type": "error",
    "name": "ZeroAddress",
    "inputs": []
  },
  {
    "type": "error",
    "name": "ZeroAmount",
    "inputs": []
  }
] as const;
