const axios = require('axios');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Replace with your Polygonscan API key
const API_KEY = process.env.API_KEY;
const BASE_URL = 'https://api.polygonscan.com/api';
const ADDRESS = '0x0000000000000000000000000000000000001010'; // Example address, replace with the desired address
const START_BLOCK = 0;
const END_BLOCK = 99999999;
const BLOCK_STEP = 100000; // Adjust the block step size if necessary

async function getTokenContractAddresses() {
    let contractAddresses = new Set();
    let currentStartBlock = START_BLOCK;
    let currentEndBlock = currentStartBlock + BLOCK_STEP;
    const offset = 1000; // Number of results per page

    while (currentStartBlock < END_BLOCK) {
        let page = 1;
        let hasMoreResults = true;

        while (hasMoreResults) {
            try {
                const response = await axios.get(BASE_URL, {
                    params: {
                        module: 'account',
                        action: 'tokentx',
                        address: ADDRESS,
                        startblock: currentStartBlock,
                        endblock: currentEndBlock,
                        page: page,
                        offset: offset,
                        sort: 'asc',
                        apikey: API_KEY
                    }
                });

                if (response.data.status === '1' && response.data.result) {
                    const tokens = response.data.result;

                    tokens.forEach(token => {
                        contractAddresses.add(token.contractAddress);
                    });

                    if (tokens.length < offset) {
                        hasMoreResults = false;
                    } else {
                        page++;
                    }
                } else {
                    console.error('Error fetching tokens:', response.data.message);
                    hasMoreResults = false;
                }
            } catch (error) {
                console.error('Error fetching tokens:', error);
                hasMoreResults = false;
            }
        }

        currentStartBlock = currentEndBlock + 1;
        currentEndBlock = currentStartBlock + BLOCK_STEP;
    }

    // Save contract addresses to a file
    fs.writeFileSync('contract_addresses.txt', Array.from(contractAddresses).join('\n'), 'utf-8');
    console.log('Contract addresses saved to contract_addresses.txt');
    main();
}

// getTokenContractAddresses()


async function getTokensWithReputation() {
    try {
        const response = await axios.get(BASE_URL, {
            params: {
                module: 'account',
                action: 'tokentx',
                address: '0x0000000000000000000000000000000000001010', // Address with token transactions
                startblock: 0,
                endblock: 99999999,
                sort: 'asc',
                apikey: API_KEY
            }
        });

        if (response.data.status === '1' && response.data.result) {
            const tokens = response.data.result;
            
            // Filtering tokens with OK or Neutral reputation might not be supported directly by the API
            // Assuming all tokens from this endpoint and we handle filtering manually if needed
            const contractAddresses = [...new Set(tokens.map(token => token.contractAddress))];

            // Save contract addresses to a file
            fs.writeFileSync('contract_addresses.txt', contractAddresses.join('\n'), 'utf-8');
            console.log('Contract addresses saved to contract_addresses.txt');
            main();
        } else {
            console.error('Error fetching tokens:', response.data.message);
        }
    } catch (error) {
        console.error('Error fetching tokens:', error);
    }
}

getTokensWithReputation();

const getTransactions = async (walletAddress) => {
    const url = `${BASE_URL}?module=account&action=txlist&address=${walletAddress}&startblock=0&endblock=99999999&sort=asc&apikey=${API_KEY}`;
    try {
        const response = await axios.get(url);
        return response.data;
    } catch (error) {
        console.error(`Error fetching transactions: ${error}`);
        return null;
    }
};

const extractAddresses = (transactions) => {
    const addresses = new Set();
    transactions.forEach(tx => {
        addresses.add(tx.from);
        addresses.add(tx.to);
    });
    return addresses;
};

const saveAddressesToFile = (addresses, filename) => {
    const fileContent = Array.from(addresses).join('\n');
    fs.writeFileSync(filename, fileContent, 'utf8');
};

const processWalletAddresses = async (walletAddresses) => {
    for (let i = 0; i < walletAddresses.length; i++) {
        const walletAddress = walletAddresses[i];
        let allAddresses = new Set();

        const fetchTransactionsAndExtractAddresses = async () => {
            const transactionsData = await getTransactions(walletAddress);
            if (transactionsData && transactionsData.status === '1') {
                const addresses = extractAddresses(transactionsData.result);
                addresses.forEach(address => allAddresses.add(address));
                console.log(`Extracted ${addresses.size} unique addresses in this batch for ${walletAddress}.`);
            } else {
                console.log(`Error fetching transactions or no transactions found for ${walletAddress}.`);
            }
        };

        // Fetch transactions and extract addresses for the current wallet address
        await fetchTransactionsAndExtractAddresses();

        // Save the addresses to a file after processing each wallet address
        saveAddressesToFile(allAddresses, `addresses_${walletAddress}.txt`);
        console.log(`Total unique addresses extracted for ${walletAddress}: ${allAddresses.size}`);
    }
};

const main = async () => {
    const filePath = path.join(__dirname, 'contract_addresses.txt');
    const walletAddresses = fs.readFileSync(filePath, 'utf-8').split('\n').filter(Boolean);
    await processWalletAddresses(walletAddresses);
};



