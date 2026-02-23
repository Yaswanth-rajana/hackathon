from app.services.blockchain.block import Block

def proof_of_work(block: Block, difficulty: int) -> str:
    target = "0" * difficulty
    while block.hash[:difficulty] != target:
        block.nonce += 1
        block.hash = block.calculate_hash()
    return block.hash
