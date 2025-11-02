// vars
let localStream = null;

// DOM elements
const localVideo = document.getElementById('localVideo');

const getLocalStream = async () => {
    if (!window.isSecureContext) {
        throw new Error('This page is not secure');
    }

    // secure contextではnavigator.mediaDevicesが存在することになっている。本当は型ガードorNon-Null assertionとか使うべきかも
    const localStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
    })

    return localStream;
}
const startMedia = async () => {
    try {
        localStream = await getLocalStream();
    } catch (error) {
        console.error('Failed to start media', error);
        throw error;
    }
    finally {
        localStream = null;
    }

    localVideo.srcObject = localStream;
}