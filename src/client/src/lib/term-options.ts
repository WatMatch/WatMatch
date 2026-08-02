const TERM_SEASONS = ["Winter", "Spring", "Fall"] as const;

export function buildTermOptions(anchorYear = new Date().getFullYear()): string[] {
    const years = Array.from({ length: 5 }, (_, index) => anchorYear - 1 + index);
    return years.flatMap((year) => TERM_SEASONS.map((season) => `${season} ${year}`));
}

export function withExistingTerm(options: string[], value?: string | null): string[] {
    const trimmed = (value || "").trim();
    if (!trimmed || options.includes(trimmed)) {
        return options;
    }
    return [...options, trimmed];
}
