import json
import os
from collections import defaultdict

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


def clean_up_data(data):
    """
    Clean up data by merging entries with the same Project Name and Year.
    """
    grouped_data = defaultdict(lambda: defaultdict(list))

    for entry in data:
        key = (entry["Project Name"], entry["Year"])
        grouped_data[key]["Departments"].append(entry["Department"])
        grouped_data[key]["Students"].extend(entry["Students"])
        grouped_data[key]["Description"] = entry["Description"]
        grouped_data[key]["Year"] = entry["Year"]

    cleaned_data = []
    for (project_name, year), details in grouped_data.items():
        # Remove duplicates in Departments and Students
        departments = list(set(details["Departments"]))
        students = list(set(details["Students"]))
        cleaned_data.append({
            "Project Name": project_name,
            "Students": students,
            "Description": details["Description"],
            "Department": departments,
            "Year": year
        })

    return cleaned_data


# List of years to process
YEARS = [2025, 2024, 2020, 2019, 2018, 2017, 2016]

for year in YEARS:
    data = load_json_data(year)
    
    if data:
        # Clean up the data
        cleaned_data = clean_up_data(data)
        
        # Save cleaned data back to the same file, overwriting the old data
        filename = f"uwaterloo_capstone_{year}.json"
        with open(filename, 'w', encoding="utf-8") as f:
            json.dump(cleaned_data, f, indent=2, ensure_ascii=False)

        print(f"Cleaned data for {year} has been saved to {filename}")
