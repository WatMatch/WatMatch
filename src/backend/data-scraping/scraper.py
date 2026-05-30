# import requests
# from bs4 import BeautifulSoup
# import json
# import time
# import re

# BASE_URL = "https://uwaterloo.ca"
# HEADERS = {
#     "User-Agent": "Mozilla/5.0"
# }

# BASE_YEAR_URLS = {
#     "2025": "https://uwaterloo.ca/capstone-design/project-abstracts/2025-capstone-design-projects",
#     "2024": "https://uwaterloo.ca/capstone-design/project-abstracts/2024-capstone-design-projects",
#     # "2023": "https://uwaterloo.ca/capstone-design/2023-capstone-design-projects",
#     # "2022": "https://uwaterloo.ca/capstone-design/2022-capstone-design-projects",
#     # "2021": "https://uwaterloo.ca/capstone-design/project-abstracts/2021-projects",
#     # "2020": "https://uwaterloo.ca/capstone-design/project-abstracts/2020-projects",
#     # "2019": "https://uwaterloo.ca/capstone-design/project-abstracts/2019-projects",
#     # "2018": "https://uwaterloo.ca/capstone-design/project-abstracts/2018-projects",
#     # "2017": "https://uwaterloo.ca/capstone-design/project-abstracts/2017-projects",
#     # "2016": "https://uwaterloo.ca/capstone-design/project-abstracts/2016-projects"
# }



# def get_department_links(base_url, year):
#     """Scrape department page links for a given year from base URL."""
#     print(f"Scraping year index: {base_url}")
#     resp = requests.get(base_url, headers=HEADERS)
#     soup = BeautifulSoup(resp.text, 'html.parser')

#     dept_links = []
#     header_text = f"{year} Capstone Design Projects"
#     header = soup.find(lambda tag: tag.name.startswith('h') and header_text in tag.text)

#     if not header:
#         print(f"Couldn't find header '{header_text}' for {year}, using fallback link scan...")
#         # If not found, fallback: look for all links on page matching the year pattern
#         for a in soup.find_all('a', href=True):
#             href = a['href']
#             if f"{year}-" in href and 'capstone' in href:
#                 dept_links.append((a.text.strip(), BASE_URL + href))
#         return dept_links

#     for tag in header.find_all_next(['a'], limit=100):
#         href = tag.get('href', '')
#         if href.startswith('/') and f"{year}-" in href:
#             dept_links.append((tag.text.strip(), BASE_URL + href))
#         elif href.startswith(base_url):
#             dept_links.append((tag.text.strip(), href))

#         if tag.name == 'h2' and tag.text.strip() != header_text:
#             break

#     return dept_links


# def is_probable_project_title(text):
#     return bool(re.match(r"^\d+\.\s+", text.strip())) or text.isupper() is False


# def clean_project_title(title):
#     return re.sub(r"^\d+\.\s*", "", title).strip()


# def extract_projects(dept_name, dept_url):
#     print(f"  -> Scraping department: {dept_name}")
#     resp = requests.get(dept_url, headers=HEADERS)
#     soup = BeautifulSoup(resp.text, 'html.parser')

#     projects = []
#     current = None

#     for tag in soup.find_all(['h2', 'p']):
#         if tag.name == 'h2':
#             title = tag.get_text(strip=True)
#             if current and current['Project Name'] and current['Students']:
#                 projects.append(current)
#             if is_probable_project_title(title):
#                 current = {
#                     "Project Name": clean_project_title(title),
#                     "Students": [],
#                     "Description": "",
#                     "Department": dept_name,
#                     "Year": year
#                 }
#             else:
#                 current = None
#         elif tag.name == 'p' and current:
#             text = tag.get_text(strip=True)
#             if not current["Students"] and ',' in text and len(text.split()) < 40:
#                 current["Students"] = [s.strip() for s in text.split(',')]
#             else:
#                 current["Description"] += " " + text if current["Description"] else text

#     if current and current['Project Name'] and current['Students']:
#         projects.append(current)

#     return projects


# def scrape_from_base_url(base_url, year):
#     all_projects = []
#     departments = get_department_links(base_url, year)

#     for dept_name, dept_url in departments:
#         try:
#             projects = extract_projects(dept_name, dept_url)
#             all_projects.extend(projects)
#         except Exception as e:
#             print(f"Failed to scrape {dept_name}: {e}")
#         time.sleep(1)  # Be polite
#     return all_projects


# def save_to_json(data, year):
#     with open(f"uwaterloo_capstone_{year}.json", "w", encoding="utf-8") as f:
#         json.dump(data, f, indent=2, ensure_ascii=False)


# if __name__ == "__main__":
#     for year, base_url in BASE_YEAR_URLS.items():
#         print(f"\n=== Scraping Year: {year} ===")
#         year_data = scrape_from_base_url(base_url, year)
#         save_to_json(year_data, year)
#         print(f"Saved {len(year_data)} projects for {year}.\n")



import requests
from bs4 import BeautifulSoup
import json
import time
import re

BASE_URL = "https://uwaterloo.ca"
HEADERS = {
    "User-Agent": "Mozilla/5.0"
}

BASE_YEAR_URLS = {
    # "2025": "https://uwaterloo.ca/capstone-design/project-abstracts/2025-capstone-design-projects",
    # "2024": "https://uwaterloo.ca/capstone-design/project-abstracts/2024-capstone-design-projects",
    "2023": "https://uwaterloo.ca/capstone-design/2023-capstone-design-projects",
    "2022": "https://uwaterloo.ca/capstone-design/2022-capstone-design-projects",
    "2021": "https://uwaterloo.ca/capstone-design/project-abstracts/2021-projects",
    # "2020": "https://uwaterloo.ca/capstone-design/project-abstracts/2020-projects",
    # "2019": "https://uwaterloo.ca/capstone-design/project-abstracts/2019-projects",
    # "2018": "https://uwaterloo.ca/capstone-design/project-abstracts/2018-projects",
    # "2017": "https://uwaterloo.ca/capstone-design/project-abstracts/2017-projects",
    # "2016": "https://uwaterloo.ca/capstone-design/project-abstracts/2016-projects"
}



def clean_project_title(title):
    """Remove unwanted numbers or characters from project title."""
    return re.sub(r"^\d+\.\s*", "", title).strip()

def get_department_links(base_url, year):
    """Scrape department page links for a given year from base URL."""
    print(f"Scraping year index: {base_url}")
    resp = requests.get(base_url, headers=HEADERS)
    soup = BeautifulSoup(resp.text, 'html.parser')

    dept_links = []
    header_text = f"{year} Projects"
    header = soup.find(lambda tag: tag.name.startswith('h') and header_text in tag.text)

    if not header:
        print(f"Couldn't find header '{header_text}' for {year}, using fallback link scan...")
        for a in soup.find_all('a', href=True):
            href = a['href']
            if f"{year}-" in href and 'capstone' in href:
                dept_links.append((a.text.strip(), BASE_URL + href))
        return dept_links

    for a in soup.find_all('a', href=True):
        href = a['href']
        if f"{year}-" in href:
            dept_links.append((a.text.strip(), BASE_URL + href))

    return dept_links

import re

def looks_like_team_members(text):
    """Heuristic to check if text looks like a list of team members."""
    # Name part: either a particle or a capitalized word (with accents, hyphens, apostrophes)
    # Allow unicode letters for international names
    name_part = r'(?:(?:de|van|von|del|da|di|le|la|el)\s+)?[A-Z][\w\-\']*'
    
    # Middle initial: single letter followed by period
    middle_initial = r'[A-Z]\.'
    
    # Title prefix: Prof., Dr., etc.
    title = r'(?:Prof\.|Dr\.|Mr\.|Ms\.|Mrs\.)\s+'
    
    # Regular person pattern (at least first + last name):
    # - Optional title
    # - First name (capitalized word)
    # - Optional middle initial(s)
    # - Optional parenthetical name (alternative name)
    # - One or more name parts (middle names, last name with optional particle)
    # - Optional parenthetical role/title at the end
    regular_person = rf'(?:{title})?[A-Z][\w\-\']+(?:\s+{middle_initial})?(?:\s+\([^)]+\))?(?:\s+{name_part})+(?:\s+\([^)]+\))?'
    
    # Person in parentheses with optional role: (FirstName LastName) or (FirstName LastName, Role) or (FirstName LastName – Role)
    # Allow single name in parentheses too
    parenthetical_person = r'\([A-Z][\w\-\']+(?:\s+[A-Z][\w\-\']+)*(?:\s*[,–]\s*[^)]+)?\)'
    
    # Single name (edge case for typos like "Hogenbirk")
    single_name = r'[A-Z][\w\-\']+'
    
    # Person can be: regular person with full name, parenthetical person, or single name
    person = rf'(?:{regular_person}|{parenthetical_person}|{single_name})'
    
    # Separators: comma with optional space, optional "and" with spaces, or ampersand with optional spaces
    # The key is to allow ", and " as a separator (comma followed by and)
    separator = r'(?:,\s*(?:and\s+)?|\s+and\s+|\s*&\s*)'
    
    # Full pattern: one person, optionally followed by separator and more people
    pattern = rf'^{person}(?:{separator}{person})*$'
    
    return bool(re.match(pattern, text.strip(), re.UNICODE))

def extract_projects(dept_name, dept_url):
    """Extract project details from department URL."""
    print(f"  -> Scraping department: {dept_name}")
    resp = requests.get(dept_url, headers=HEADERS)
    soup = BeautifulSoup(resp.text, 'html.parser')

    projects = []
    # Find all h3 tags which contain project titles
    project_titles = soup.find_all('h3')

    for title_tag in project_titles:
        project_name = title_tag.get_text(strip=True)

        # Try to extract team members and description
        team_members = []
        description = ""
        
        # First <p> tag may contain either team members or description
        first_p = title_tag.find_next('p')
        if first_p:
            first_p_text = first_p.get_text(strip=True)

            # Case 1: If first <p> contains "Team Members:" or looks like a team list
            if 'team members' in first_p_text.lower() or 'group members' in first_p_text.lower() or looks_like_team_members(first_p_text):
                # If it's a team list, consider it team members and continue
                team_members = [name.replace('Team members: ', '').replace('Group members:', '').strip() for name in first_p_text.split(',')]
                # Next <p> should contain the description
                second_p = first_p.find_next('p')
                description = second_p.get_text(strip=True) if second_p else ""
            else:
                # Case 2: If the first <p> is the description, check the next <p> for team members
                description = first_p_text
                second_p = first_p.find_next('p')
                if second_p:
                    second_p_text = second_p.get_text(strip=True)
                    if 'team members' in second_p_text.lower() or 'group members' in second_p_text.lower() or looks_like_team_members(second_p_text):
                        team_members = [name.replace('Team members:', '').replace('Group members:', '').strip() for name in second_p_text.split(',')]

        # If no team members found in description paragraph, set it as an empty list
        if not team_members:
            team_members = []

        # Format the project into the desired structure
        project = {
            "Department": dept_name,
            "Project Name": clean_project_title(project_name),
            "Description": description,
            "Team Members": team_members,
            "Year": year
        }

        projects.append(project)

    return projects




def scrape_from_base_url(base_url, year):
    """Scrape all departments and projects for a specific year."""
    all_projects = []
    departments = get_department_links(base_url, year)

    for dept_name, dept_url in departments:
        try:
            projects = extract_projects(dept_name, dept_url)
            all_projects.extend(projects)
        except Exception as e:
            print(f"Failed to scrape {dept_name}: {e}")
        time.sleep(1)  # Be polite
    return all_projects

def save_to_json(data, year):
    """Save extracted data to a JSON file."""
    with open(f"uwaterloo_capstone_{year}.json", "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

if __name__ == "__main__":
    for year, base_url in BASE_YEAR_URLS.items():
        print(f"\n=== Scraping Year: {year} ===")
        year_data = scrape_from_base_url(base_url, year)
        save_to_json(year_data, year)
        print(f"Saved {len(year_data)} projects for {year}.\n")