// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/utils/Base64.sol";

/**
 * @title AuditBadgeNFT
 * @dev Mints fully on-chain SVG NFT badges as proof of completing a Web3 Guard security audit.
 *      These are soulbound (non-transferable) to the wallet that requested the audit.
 */
contract AuditBadgeNFT is ERC721 {
    using Strings for uint256;

    uint256 public nextTokenId;
    address public owner;

    struct BadgeData {
        string contractAudited;  // The address or label of the contract audited
        uint256 vulnsFound;      // Number of vulnerabilities detected
        string severity;         // "SECURE", "LOW", "MEDIUM", "HIGH"
        uint256 timestamp;       // Block timestamp
    }

    mapping(uint256 => BadgeData) public badges;

    error Unauthorized();
    error SoulboundTransfer();

    event BadgeMinted(uint256 indexed tokenId, address indexed recipient, string contractAudited, uint256 vulnsFound);

    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }

    constructor() ERC721("Web3 Guard Audit Badge", "W3GBADGE") {
        owner = msg.sender;
    }

    /**
     * @dev Mints a new audit badge NFT to the recipient.
     */
    function mintBadge(
        address recipient,
        string memory contractAudited,
        uint256 vulnsFound,
        string memory severity
    ) public onlyOwner returns (uint256) {
        uint256 tokenId = nextTokenId;

        badges[tokenId] = BadgeData({
            contractAudited: contractAudited,
            vulnsFound: vulnsFound,
            severity: severity,
            timestamp: block.timestamp
        });

        _safeMint(recipient, tokenId);
        emit BadgeMinted(tokenId, recipient, contractAudited, vulnsFound);

        nextTokenId++;
        return tokenId;
    }

    /**
     * @dev Generates a fully on-chain SVG badge with dynamic colors based on severity.
     */
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);

        BadgeData memory badge = badges[tokenId];

        // Dynamic color based on severity
        string memory bgColor;
        string memory accentColor;
        string memory statusText;
        if (keccak256(bytes(badge.severity)) == keccak256(bytes("SECURE"))) {
            bgColor = "#0a0a0a";
            accentColor = "#10B981";
            statusText = "ALL CLEAR";
        } else if (keccak256(bytes(badge.severity)) == keccak256(bytes("HIGH"))) {
            bgColor = "#0a0a0a";
            accentColor = "#FF4522";
            statusText = "HIGH RISK";
        } else if (keccak256(bytes(badge.severity)) == keccak256(bytes("MEDIUM"))) {
            bgColor = "#0a0a0a";
            accentColor = "#F59E0B";
            statusText = "MEDIUM RISK";
        } else {
            bgColor = "#0a0a0a";
            accentColor = "#3B82F6";
            statusText = "LOW RISK";
        }

        // Build on-chain SVG
        bytes memory svg = abi.encodePacked(
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 500" style="background:', bgColor, '">',
            '<rect width="400" height="500" fill="', bgColor, '" />',
            '<rect x="20" y="20" width="360" height="460" fill="none" stroke="', accentColor, '" stroke-width="3" />',
            '<text x="40" y="70" font-family="monospace" font-size="12" fill="', accentColor, '" letter-spacing="4">WEB3 GUARD</text>',
            '<text x="40" y="100" font-family="monospace" font-size="9" fill="#666" letter-spacing="3">PROOF OF AUDIT</text>',
            '<line x1="40" y1="120" x2="360" y2="120" stroke="', accentColor, '" stroke-width="1" opacity="0.3" />',
            '<text x="40" y="170" font-family="monospace" font-size="36" fill="#fff" font-weight="bold">', statusText, '</text>'
        );

        bytes memory svg2 = abi.encodePacked(
            '<text x="40" y="220" font-family="monospace" font-size="10" fill="#888" letter-spacing="2">TARGET CONTRACT</text>',
            '<text x="40" y="245" font-family="monospace" font-size="11" fill="#ccc">', _truncate(badge.contractAudited, 36), '</text>',
            '<text x="40" y="290" font-family="monospace" font-size="10" fill="#888" letter-spacing="2">VULNERABILITIES</text>',
            '<text x="40" y="325" font-family="monospace" font-size="42" fill="', accentColor, '" font-weight="bold">', badge.vulnsFound.toString(), '</text>',
            '<text x="40" y="400" font-family="monospace" font-size="10" fill="#888" letter-spacing="2">TOKEN ID</text>',
            '<text x="40" y="425" font-family="monospace" font-size="14" fill="#fff">#', tokenId.toString(), '</text>',
            '<rect x="40" y="450" width="320" height="20" fill="', accentColor, '" opacity="0.15" />',
            '<text x="200" y="464" font-family="monospace" font-size="8" fill="', accentColor, '" text-anchor="middle" letter-spacing="3">SOULBOUND - NON TRANSFERABLE</text>',
            '</svg>'
        );

        // Build JSON metadata
        bytes memory json = abi.encodePacked(
            '{"name": "Web3 Guard Audit #', tokenId.toString(),
            '", "description": "On-chain proof of a smart contract security audit performed by Web3 Guard AI.",',
            '"image": "data:image/svg+xml;base64,', Base64.encode(abi.encodePacked(svg, svg2)), '",'
        );

        bytes memory json2 = abi.encodePacked(
            '"attributes": [',
            '{"trait_type": "Severity", "value": "', badge.severity, '"},',
            '{"trait_type": "Vulnerabilities Found", "value": ', badge.vulnsFound.toString(), '},',
            '{"trait_type": "Contract Audited", "value": "', badge.contractAudited, '"},',
            '{"trait_type": "Soulbound", "value": "true"}',
            ']}'
        );

        return string(
            abi.encodePacked(
                "data:application/json;base64,",
                Base64.encode(abi.encodePacked(json, json2))
            )
        );
    }

    /**
     * @dev Truncates a string to maxLen characters and appends "..." if needed.
     */
    function _truncate(string memory str, uint256 maxLen) internal pure returns (string memory) {
        bytes memory strBytes = bytes(str);
        if (strBytes.length <= maxLen) return str;
        
        bytes memory result = new bytes(maxLen + 3);
        for (uint256 i = 0; i < maxLen; i++) {
            result[i] = strBytes[i];
        }
        result[maxLen] = '.';
        result[maxLen + 1] = '.';
        result[maxLen + 2] = '.';
        return string(result);
    }

    /**
     * @dev Override transfer to make tokens soulbound (non-transferable).
     */
    function _update(address to, uint256 tokenId, address auth) internal override returns (address) {
        address from = _ownerOf(tokenId);
        // Allow minting (from == address(0)) but block transfers
        if (from != address(0) && to != address(0)) {
            revert SoulboundTransfer();
        }
        return super._update(to, tokenId, auth);
    }
}
