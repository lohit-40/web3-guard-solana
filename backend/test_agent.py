import asyncio
import json
from agents import AnalystAgent
from memory import teach_memory

async def test():
    # 1. Teach the agent a historical lesson
    print("=== Teaching Agent a New Lesson ===")
    teach_result = teach_memory(
        vulnerability_type="Integer Underflow",
        lesson_text="Any arithmetic operation like 'amount - 100' without using checked_sub() or require!() constraints is an automatic CRITICAL integer underflow vulnerability on Solana."
    )
    print(teach_result)

    # 2. Run the analysis
    agent = AnalystAgent()
    # Using the standard SPL Token program address as a test
    program_id = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA" 
    source_code = """
    use anchor_lang::prelude::*;
    declare_id!("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
    
    #[program]
    pub mod vulnerable_program {
        use super::*;
        pub fn process_instruction(ctx: Context<Initialize>, amount: u64) -> Result<()> {
            // Intentional vulnerability: No overflow check
            let x = amount - 100;
            Ok(())
        }
    }
    """
    
    print("\n=== Starting AnalystAgent Test ===")
    result = await agent.analyze(program_id=program_id, source_code=source_code, prev_vulns=[])
    
    print("\n=== Final JSON Result ===")
    print(json.dumps(result, indent=2))

if __name__ == "__main__":
    asyncio.run(test())
