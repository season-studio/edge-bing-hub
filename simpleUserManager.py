import pyotp
import jwt
import datetime

def parseUserInfoList(name, totpKey = None, jwtKey = None):
    if len(name.strip()) == 0:
        name = None
    if not isinstance(totpKey, str) or len(totpKey.strip()) == 0:
        totpKey = None
    if not isinstance(jwtKey, str) or len(jwtKey.strip()) == 0:
        jwtKey = None
    return (name, (totpKey, jwtKey))

def parseUserInfoLine(line: str):
    return parseUserInfoList(*line.split(":"))

class SimpleUserManager(object):
    def __init__(self, usersFilePath, appName):
        self.__usersFilePath = usersFilePath
        self.appName = appName
        self.__loadUsers()

    def __loadUsers(self):
        users = {}
        with open(self.__usersFilePath, 'r', encoding="utf-8") as f:
            for line in f.readlines():
                user, infos = parseUserInfoLine(line)
                if user != None:
                    users[user] = infos
        self.__users = users

    def __saveUsers(self):
        lines = []
        for user, infos in self.__users.items():
            totpKey, jwtKey = infos
            lines.append(f"{user if isinstance(user, str) else ''}:{totpKey if isinstance(totpKey, str) else ''}:{jwtKey if isinstance(jwtKey, str) else ''}")
        with open(self.__usersFilePath, "w", encoding="utf-8") as f:
            f.write("\n".join(lines))

    def hasUser(self, user: str):
        return user in self.__users

    def isUserInit(self, user: str):
        if user in self.__users:
            totpKey, jwtKey = self.__users[user]
            if isinstance(totpKey, str) and len(totpKey.strip()) > 0 and isinstance(jwtKey, str) and len(jwtKey.strip()) > 0:
                return True
        return False
    
    def getUserInfo(self, user: str):
        if user in self.__users:
            return self.__users[user]
        else:
            return (None, None)
        
    def initUserStart(self, user: str):
        if (user in self.__users) and self.__users[user][1] is None:
            key = pyotp.random_base32()
            self.__users[user] = (key, None)
            totp = pyotp.TOTP(key)
            return totp.provisioning_uri(name=f"{user}@season-studio.top", issuer_name=self.appName)
        return None
    
    def initUserFinal(self, user: str, code: str, expDays: datetime.timedelta = datetime.timedelta(days=1)):
        if user in self.__users:
            totpKey, jwtKey = self.__users[user]
            if isinstance(totpKey, str) and len(totpKey.strip()) > 0 and (not isinstance(jwtKey, str) or len(jwtKey.strip()) <= 0):
                totp = pyotp.TOTP(totpKey)
                if totp.verify(code):
                    jwtKey = pyotp.random_hex()
                    self.__users[user] = (totpKey, jwtKey)
                    self.__saveUsers()
                    return self.__getUserToken(user, expDays)
        return None
    
    def __getUserToken(self, user: str, expDays: datetime.timedelta = datetime.timedelta(days=1)):
        if self.isUserInit(user):
            _, jwtKey = self.__users[user]
            return jwt.encode({
                "exp": datetime.datetime.now() + expDays,
                "iss": self.appName,
                "data": {
                    "user": user
                }
            }, jwtKey, algorithm='HS256')
        return None
    
    def checkUserToken(self, user: str, token: str):
        try:
            _, jwtKey = self.__users[user]
            data = jwt.decode(token, jwtKey, issuer=self.appName, algorithms=['HS256'])
            return data["data"]["user"] == user
        except Exception:
            return False
        
    def checkUserTokenWithUpdate(self, user: str, token: str, updateDelta = datetime.timedelta(days=1), expDays: datetime.timedelta = datetime.timedelta(days=1)):
        _, jwtKey = self.__users[user]
        data = jwt.decode(token, jwtKey, issuer=self.appName, algorithms=['HS256'])
        if data["data"]["user"] != user:
            raise RuntimeError("Bad user or password!")
        if (datetime.datetime.fromtimestamp(data["exp"]) - datetime.datetime.now()) <= updateDelta:
            return self.__getUserToken(user, expDays)
        return None
    
    def checkUserOtpWithWithUpdateToken(self, user: str, otpCode: str, expDays: datetime.timedelta = datetime.timedelta(days=1)):
        totpKey, jwtKey = self.__users[user]
        totp = pyotp.TOTP(totpKey)
        if totp.verify(otpCode):
            return self.__getUserToken(user, expDays)
        else:
            raise RuntimeError("Bad user or password!")