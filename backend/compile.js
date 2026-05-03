const path = require('path');
const fs = require('fs');
const solc = require('solc');

const contractPath = path.resolve(__dirname, 'ProofOfAudit.sol');
const source = fs.readFileSync(contractPath, 'utf8');

const input = {
    language: 'Solidity',
    sources: {
        'ProofOfAudit.sol': {
            content: source,
        },
    },
    settings: {
        outputSelection: {
            '*': {
                '*': ['abi', 'evm.bytecode.object'],
            },
        },
    },
};

const output = JSON.parse(solc.compile(JSON.stringify(input)));
const contract = output.contracts['ProofOfAudit.sol']['ProofOfAudit'];

const artifact = {
    abi: contract.abi,
    bytecode: contract.evm.bytecode.object
};

fs.writeFileSync(
    path.resolve(__dirname, 'ProofOfAudit.json'),
    JSON.stringify(artifact, null, 2)
);

console.log("Contract successfully compiled to ProofOfAudit.json!");
