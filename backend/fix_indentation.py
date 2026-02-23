import autopep8

file_path = "/Users/yaswanthrajana/Documents/Hackathon/backend/app/services/dealer_distribution_service.py"

with open(file_path, "r") as f:
    code = f.read()

fixed_code = autopep8.fix_code(code)

with open(file_path, "w") as f:
    f.write(fixed_code)
