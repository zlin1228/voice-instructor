
const languageNames = new Intl.DisplayNames(['en'], {
    type: 'language'
});

export const getLanguageNameFallback = (languageCode: string): string => {
    const lang = languageNames.of(languageCode.toUpperCase())
    if (lang === undefined) {
        return "English";
    } else {
        return lang;
    }
}