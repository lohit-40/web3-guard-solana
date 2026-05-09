use anchor_lang::prelude::*;

// This is a placeholder Program ID. During deployment, Anchor will replace this.
declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod proof_of_audit {
    use super::*;

    pub fn initialize_audit(
        ctx: Context<InitializeAudit>, 
        contract_address: String, 
        logic_hash: String, 
        vulnerabilities_found: u32
    ) -> Result<()> {
        let audit_record = &mut ctx.accounts.audit_record;
        
        audit_record.developer = ctx.accounts.developer.key();
        audit_record.contract_address = contract_address;
        audit_record.logic_hash = logic_hash;
        audit_record.vulnerabilities_found = vulnerabilities_found;
        audit_record.timestamp = Clock::get()?.unix_timestamp;

        msg!("Web3 Guard Audit Recorded!");
        msg!("Target Contract: {}", audit_record.contract_address);
        msg!("Vulns Found: {}", audit_record.vulnerabilities_found);
        
        Ok(())
    }
}

// 1. Definition of the Accounts required for `initialize_audit`
#[derive(Accounts)]
#[instruction(contract_address: String)]
pub struct InitializeAudit<'info> {
    #[account(
        init, 
        // We derive the PDA address using "audit" seed, developer pubkey, and the contract string
        seeds = [b"audit", developer.key().as_ref(), contract_address.as_bytes()], 
        bump, 
        // Space allocation: 8 bytes discriminator + struct fields
        payer = developer, 
        space = 8 + 32 + 100 + 100 + 4 + 8
    )]
    pub audit_record: Account<'info, AuditRecord>,

    #[account(mut)]
    pub developer: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

// 2. Definition of the Data Structure stored on-chain
#[account]
pub struct AuditRecord {
    pub developer: Pubkey,          // 32 bytes
    pub contract_address: String,   // ~100 bytes
    pub logic_hash: String,         // ~100 bytes (SHA256 hash or IPFS CID)
    pub vulnerabilities_found: u32, // 4 bytes
    pub timestamp: i64,             // 8 bytes
}
