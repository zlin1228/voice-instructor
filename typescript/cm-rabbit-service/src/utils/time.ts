
export function formatDateTime(timeZone: string) {
    const date = new Date();
    let formattedDateTime;

    // Check if timeZone is a UTC offset
    const utcOffsetMatch = timeZone.match(/^UTC([+-]\d{1,2}):?(\d{2})?$/);
    if (utcOffsetMatch) {
        const [, hours, minutes = '0'] = utcOffsetMatch;
        const offsetInMinutes = parseInt(hours ?? "0") * 60 + parseInt(minutes);
        date.setMinutes(date.getMinutes() + date.getTimezoneOffset() + offsetInMinutes);
        formattedDateTime = date.toLocaleString("en-US", { month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: 'numeric', hour12: true });
    } else {
        // Assume timeZone is an IANA time zone string
        try {
            formattedDateTime = date.toLocaleString("en-US", { timeZone, hour: 'numeric', minute: 'numeric', hour12: true, day: 'numeric', month: 'long', year: 'numeric' });
        } catch (error) {
            console.error('Invalid timeZone provided:', timeZone);
            return date.toLocaleString("en-US", { timeZone: 'America/New_York', hour: 'numeric', minute: 'numeric', hour12: true, day: 'numeric', month: 'long', year: 'numeric' });
        }
    }

    return formattedDateTime;
}
