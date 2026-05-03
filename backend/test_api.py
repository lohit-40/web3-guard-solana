import requests
import json

vuln_code = """
pragma solidity ^0.8.0;
contract Reentrancy {
    mapping(address => uint) public balances;
    function withdraw() public {
        uint bal = balances[msg.sender];
        require(bal > 0);
        (bool sent, ) = msg.sender.call{value: bal}("");
        require(sent, "Failed to send Ether");
        balances[msg.sender] = 0;
    }
}
"""

res = requests.post("http://127.0.0.1:8001/scan", json={"source_code": vuln_code})
print(f"Status: {res.status_code}")
print(json.dumps(res.json(), indent=2))
