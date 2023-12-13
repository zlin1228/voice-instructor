function isSafari() {
    const userAgent = window.navigator.userAgent;
    const isSafari = userAgent.indexOf("Safari") !== -1 && userAgent.indexOf("Chrome") === -1;
    return isSafari;
}

function useIsSafari() {
    const safariDetected = isSafari();

    return safariDetected;
}

export default useIsSafari;