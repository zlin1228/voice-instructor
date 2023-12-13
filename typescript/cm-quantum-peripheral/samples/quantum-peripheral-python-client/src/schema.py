import pydantic
import typing
import datetime


class ObjectType_1(pydantic.BaseModel):
    url: str


class ObjectType_2(pydantic.BaseModel):
    latitude: float
    longitude: float


class ObjectType_3(pydantic.BaseModel):
    northeast: ObjectType_2
    southwest: ObjectType_2


class ObjectType_4(pydantic.BaseModel):
    url: str = None
    width: pydantic.StrictInt = None
    height: pydantic.StrictInt = None


class ObjectType_5(pydantic.BaseModel):
    geoLocation: ObjectType_2
    nickname: str = None
    formattedAddress: str = None


class ObjectType_6(pydantic.BaseModel):
    pickup: ObjectType_5 = None
    dropoff: ObjectType_5


class ObjectType_7(pydantic.BaseModel):
    pickupAddress: str
    dropoffAddress: str


class ObjectType_8(pydantic.BaseModel):
    ok: bool
    logPath: str


class ObjectType_9(pydantic.BaseModel):
    formattedAddress: str = None
    formattedPhoneNumber: str = None
    adrAddress: str = None
    geoLocation: ObjectType_2 = None
    viewport: ObjectType_3 = None
    icon: str = None
    name: str = None
    openNow: bool = None
    businessStatus: str = None
    placeId: str = None
    priceLevel: pydantic.StrictInt = None
    rating: float = None
    userRatingsTotal: float = None
    types: typing.List[str]
    url: str = None
    website: str = None


class ObjectType_10(pydantic.BaseModel):
    location: ObjectType_2
    radius: float = None
    keyword: str = None
    minPrice: pydantic.StrictInt = None
    maxPrice: pydantic.StrictInt = None
    openNow: bool = None
    rankBy: str = None
    type: str = None


class ObjectType_11(pydantic.BaseModel):
    query: str


class ObjectType_13(pydantic.BaseModel):
    default: ObjectType_4 = None
    high: ObjectType_4 = None
    maxres: ObjectType_4 = None
    medium: ObjectType_4 = None
    standard: ObjectType_4 = None


class ObjectType_12(pydantic.BaseModel):
    kind: str = None
    id: str = None
    channelId: str = None
    channelTitle: str = None
    description: str = None
    publishedAt: datetime.datetime = None
    thumbnails: ObjectType_13 = None
    title: str = None
    link: str = None


class ObjectType_15(pydantic.BaseModel):
    alias: str = None
    title: str = None


class ObjectType_14(pydantic.BaseModel):
    id: str = None
    alias: str = None
    name: str = None
    imageUrl: str = None
    isClosed: bool = None
    url: str = None
    reviewCount: float = None
    categories: typing.List[ObjectType_15] = None
    rating: float = None
    geoLocation: ObjectType_2 = None
    price: str = None
    displayAddress: typing.List[str] = None
    phone: str = None
    displayPhone: str = None
    distance: float = None


class ObjectType_16(pydantic.BaseModel):
    geoLocation: ObjectType_2
    term: str = None
    radius: pydantic.StrictInt = None
    categories: typing.List[str] = None
    price: typing.List[pydantic.StrictInt] = None
    openNow: bool = None
    openAt: datetime.datetime = None
    attributes: typing.List[str] = None
    sortBy: str = None
    limit: pydantic.StrictInt
    offset: pydantic.StrictInt = None


class ObjectType_17(pydantic.BaseModel):
    businesses: typing.List[ObjectType_14]


class ObjectType_18(pydantic.BaseModel):
    site: str
    search: str
    limit: pydantic.StrictInt = None


class ObjectType_20(pydantic.BaseModel):
    title: str
    url: str


class ObjectType_19(pydantic.BaseModel):
    results: typing.List[ObjectType_20]


class ObjectType_21(pydantic.BaseModel):
    hour: pydantic.StrictInt
    minutes: pydantic.StrictInt
    message: str
    days: typing.List[pydantic.StrictInt] = None


class ObjectType_22(pydantic.BaseModel):
    lengthSeconds: pydantic.StrictInt
    message: str


class ObjectType_23(pydantic.BaseModel):
    phoneNumber: str
    smsBody: str


class ObjectType_24(pydantic.BaseModel):
    geoLocation: ObjectType_2


class ObjectType_27(pydantic.BaseModel):
    id: pydantic.StrictInt
    main: str
    description: str


class ObjectType_26(pydantic.BaseModel):
    time: datetime.datetime
    sunriseTime: datetime.datetime
    sunsetTime: datetime.datetime
    temperature: float
    feelsLikeTemperature: float
    pressure: float
    humidity: float
    clouds: float
    uvi: float
    visibility: float
    windSpeed: float
    weatherConditions: typing.List[ObjectType_27]


class ObjectType_28(pydantic.BaseModel):
    time: datetime.datetime
    temperature: float
    feelsLikeTemperature: float
    pressure: float
    humidity: float
    clouds: float
    uvi: float
    visibility: float
    windSpeed: float
    weatherConditions: typing.List[ObjectType_27]


class ObjectType_30(pydantic.BaseModel):
    morn: float
    day: float
    eve: float
    night: float
    min: float
    max: float


class ObjectType_31(pydantic.BaseModel):
    morn: float
    day: float
    eve: float
    night: float


class ObjectType_29(pydantic.BaseModel):
    time: datetime.datetime
    sunriseTime: datetime.datetime
    sunsetTime: datetime.datetime
    temperature: ObjectType_30
    feelsLikeTemperature: ObjectType_31
    pressure: float
    humidity: float
    clouds: float
    uvi: float
    windSpeed: float
    weatherConditions: typing.List[ObjectType_27]


class ObjectType_25(pydantic.BaseModel):
    current: ObjectType_26
    hourlyForecasts: typing.List[ObjectType_28]
    dailyForecasts: typing.List[ObjectType_29]


class ObjectType_32(pydantic.BaseModel):
    productId: str
    title: str
    imageUrl: str
    numReviews: float = None
    stars: str = None
    price: float = None


class ObjectType_33(pydantic.BaseModel):
    retailer: str
    query: str


class ObjectType_34(pydantic.BaseModel):
    results: typing.List[ObjectType_32]


class ObjectType_35(pydantic.BaseModel):
    firstName: str
    lastName: str
    addressLine1: str
    addressLine2: str = None
    zipCode: str
    city: str
    state: str
    country: str
    phoneNumber: str
    instructions: str = None


class ObjectType_37(pydantic.BaseModel):
    maxItemPrice: float
    handlingDaysMax: pydantic.StrictInt


class ObjectType_36(pydantic.BaseModel):
    productId: str
    quantity: pydantic.StrictInt
    sellerSelectionCriteria: ObjectType_37


class ObjectType_38(pydantic.BaseModel):
    ok: bool
    orderId: str = None
    errorCode: str = None
    errorMessage: str = None
    errorData: str = None


class ObjectType_39(pydantic.BaseModel):
    idempotencyKey: str
    retailer: str
    products: typing.List[ObjectType_36]
    shippingAddress: ObjectType_35
    shippingMethod: str
    maxPrice: float


class ObjectType_40(pydantic.BaseModel):
    id: str
    name: str
    url: str
    isFamilyFriendly: bool
    displayUrl: str
    snippet: str


class ObjectType_41(pydantic.BaseModel):
    query: str


class ObjectType_42(pydantic.BaseModel):
    webPages: typing.List[ObjectType_40]


class ObjectType_43(pydantic.BaseModel):
    title: str
    content: str


class ObjectType_44(pydantic.BaseModel):
    name: str
    url: str


class ObjectType_45(pydantic.BaseModel):
    name: str
    spotifyUri: str


class ObjectType_46(pydantic.BaseModel):
    name: str
    spotifyUri: str


class ObjectType_47(pydantic.BaseModel):
    token: str
    query: str


class ObjectType_48(pydantic.BaseModel):
    tracks: typing.List[ObjectType_45]
    playlists: typing.List[ObjectType_46]


class ObjectType_49(pydantic.BaseModel):
    token: str
    deviceId: typing.Optional[str]
    trackUris: typing.List[str] = None
    contextUri: str = None


class ObjectType_50(pydantic.BaseModel):
    token: str
    deviceId: typing.Optional[str]


class ObjectType_51(pydantic.BaseModel):
    token: str
    deviceId: typing.Optional[str]


class ObjectType_52(pydantic.BaseModel):
    token: str
    deviceId: typing.Optional[str]


class ObjectType_53(pydantic.BaseModel):
    token: str
    deviceId: typing.Optional[str]
    repeatMode: str


class ObjectType_54(pydantic.BaseModel):
    token: str
    deviceId: typing.Optional[str]
    shuffleMode: bool


class ObjectType_55(pydantic.BaseModel):
    token: str


class ObjectType_57(pydantic.BaseModel):
    id: str
    name: str
    volumePercent: pydantic.StrictInt


class ObjectType_58(pydantic.BaseModel):
    type: str
    uri: str


class ObjectType_56(pydantic.BaseModel):
    device: ObjectType_57
    repeatState: str
    shuffleState: bool
    context: typing.Optional[ObjectType_58]
    progressMs: float
    isPlaying: bool
    item: typing.Optional[ObjectType_45]
    currentlyPlayingType: str


class ObjectType_59(pydantic.BaseModel):
    token: str


class ObjectType_60(pydantic.BaseModel):
    playlists: typing.List[ObjectType_46]


LinkResponse = ObjectType_1
GeoLocation = ObjectType_2
GeoLocationBound = ObjectType_3
ImageWithDimension = ObjectType_4
UberLocation = ObjectType_5
UberRideRequestLink = ObjectType_6
UberRequestRideRequest = ObjectType_7
UberRequestRideResponse = ObjectType_8
GoogleMapsPlaceData = ObjectType_9
GoogleMapsPlacesNearby = ObjectType_10
YoutubeSearch = ObjectType_11
YoutubeResourceType = ObjectType_12
YelpBusiness = ObjectType_14
YelpBusinessesSearchRequest = ObjectType_16
YelpBusinessesSearchResponse = ObjectType_17
MediawikiSearchRequest = ObjectType_18
MediawikiSearchResponse = ObjectType_19
SystemCreateAlarmRequest = ObjectType_21
SystemCreateTimerRequest = ObjectType_22
SystemSendMessageRequest = ObjectType_23
WeatherQueryRequest = ObjectType_24
WeatherQueryResponse = ObjectType_25
WeatherCurrent = ObjectType_26
WeatherDaily = ObjectType_29
WeatherHourly = ObjectType_28
ShoppingSearchProduct = ObjectType_32
ShoppingProductSearchRequest = ObjectType_33
ShoppingProductSearchResponse = ObjectType_34
ShoppingAddress = ObjectType_35
ShoppingOrderProduct = ObjectType_36
ShoppingCreateOrderResponse = ObjectType_38
ShoppingCreateOrderRequest = ObjectType_39
BingSearchWebPage = ObjectType_40
BingSearchWebPagesRequest = ObjectType_41
BingSearchWebPagesResponse = ObjectType_42
GoogleDriveCreateNoteRequest = ObjectType_43
GoogleDriveCreateNoteResponse = ObjectType_44
SpotifyTrack = ObjectType_45
SpotifyPlaylist = ObjectType_46
SpotifySearchRequest = ObjectType_47
SpotifySearchResponse = ObjectType_48
SpotifyPlayRequest = ObjectType_49
SpotifyPauseRequest = ObjectType_50
SpotifySkipToNextRequest = ObjectType_51
SpotifySkipToPreviousRequest = ObjectType_52
SpotifySetRepeatModeRequest = ObjectType_53
SpotifySetShuffleModeRequest = ObjectType_54
SpotifyGetPlaybackStateRequest = ObjectType_55
SpotifyGetPlaybackStateResponse = ObjectType_56
SpotifyGetCurrentUserPlaylistsRequest = ObjectType_59
SpotifyGetPlaybackStateRequest = ObjectType_55
SpotifyGetCurrentUserPlaylistsResponse = ObjectType_60

