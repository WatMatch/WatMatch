import json
import os
from supabase import create_client, Client
import dotenv

# Load environment variables from .env file for sensitive data (Supabase URL and Key)
dotenv.load_dotenv()

# Initialize Supabase Client using environment variables
url = os.getenv("SUPABASE_URL")
key = os.getenv("SUPABASE_KEY")
supabase: Client = create_client(url, key)

# Function to load JSON data from a file dynamically based on year
def load_json_data(year: int):
    """Load JSON data from a file corresponding to the given year."""
    filename = f"uwaterloo_capstone_{year}.json"
    
    # Check if the file exists
    if os.path.exists(filename):
        try:
            # Open the file with UTF-8 encoding to avoid Unicode errors
            with open(filename, "r", encoding="utf-8") as file:
                data = json.load(file)
            return data
        except UnicodeDecodeError as e:
            # Handle Unicode errors gracefully
            print(f"Error reading {filename}: {e}")
            return None
    else:
        # Inform the user if the file is not found
        print(f"File {filename} not found!")
        return None


# Function to upload the loaded data to Supabase
def upload_to_supabase(data):
    """Upload parsed data to the Supabase 'past_capstones' table."""
    for project in data:
        response = supabase.table('past_capstones').insert({
            "title": project["Project Name"],  # Map to the corresponding column names in the table
            "description": project["Description"],
            "department": project["Department"],
            "year": project["Year"],
            "students": project["Students"],
        }).execute()

        # Print the response for debugging purposes
        print(response)


# List of years for which data files will be processed
YEARS = [2025, 2024, 2020, 2019, 2018, 2017, 2016]

# Iterate through the specified years, load data, and upload it to Supabase
for year in YEARS:
    data = load_json_data(year)
    if data:
        upload_to_supabase(data)
