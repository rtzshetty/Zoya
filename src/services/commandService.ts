import { Contacts } from '@capacitor-community/contacts';
import { Capacitor } from '@capacitor/core';
import { AppLauncher } from '@capacitor/app-launcher';

export async function processCommand(command: string): Promise<{
  action: string;
  url?: string;
  isBrowserAction: boolean;
  mapData?: { origin?: string; destination: string };
}> {
  const lowerCmd = command.toLowerCase().trim();

  // General Browsing/App Opening: "Open [app/website name]"
  const openMatch = lowerCmd.match(/^open\s+(.+)$/);
  if (
    openMatch &&
    !lowerCmd.includes("youtube") &&
    !lowerCmd.includes("spotify")
  ) {
    let targetName = openMatch[1].trim().replace(/\s+app$/, ""); // remove " app" if present
    
    if (Capacitor.isNativePlatform()) {
      const targetLower = targetName.toLowerCase().replace(/\s+/g, "");
      const appPackages: Record<string, string> = {
        youtube: 'com.google.android.youtube',
        spotify: 'com.spotify.music',
        whatsapp: 'com.whatsapp',
        instagram: 'com.instagram.android',
        facebook: 'com.facebook.katana',
        twitter: 'com.twitter.android',
        x: 'com.twitter.android',
        gmail: 'com.google.android.gm',
        maps: 'com.google.android.apps.maps',
        chrome: 'com.android.chrome',
        calculator: 'com.google.android.calculator',
        clock: 'com.google.android.deskclock'
      };

      if (appPackages[targetLower]) {
         try {
           await AppLauncher.openUrl({ url: appPackages[targetLower] });
           return {
             action: `Opening ${targetName} for you...`,
             isBrowserAction: true
           };
         } catch (e) {
           console.log("AppLauncher error", e);
           // Fall through to web search
         }
      }
    }

    let website = targetName.replace(/\s+/g, "");
    if (!website.includes(".")) {
      website += ".com";
    }
    return {
      action: `Opening ${targetName} for you, ugh.`,
      url: `https://www.${website}`,
      isBrowserAction: true,
    };
  }

  // Media Search: "Play [song/video] on YouTube"
  const ytMatch = lowerCmd.match(/^play\s+(.+?)\s+on\s+youtube$/);
  if (ytMatch) {
    const query = encodeURIComponent(ytMatch[1].trim());
    return {
      action: `Playing ${ytMatch[1]} on YouTube. Don't judge my music taste.`,
      url: `https://www.youtube.com/results?search_query=${query}`,
      isBrowserAction: true,
    };
  }

  // Media Search: "Search [query] on Spotify"
  const spotifyMatch = lowerCmd.match(/^search\s+(.+?)\s+on\s+spotify$/);
  if (spotifyMatch) {
    const query = encodeURIComponent(spotifyMatch[1].trim());
    return {
      action: `Searching ${spotifyMatch[1]} on Spotify. Hope it's a banger.`,
      url: `https://open.spotify.com/search/${query}`,
      isBrowserAction: true,
    };
  }

  // WhatsApp Web: "Send a WhatsApp message to [number] saying [message]"
  const waMatch = lowerCmd.match(
    /^send\s+a\s+whatsapp\s+message\s+to\s+([\d\+\s]+)\s+saying\s+(.+)$/,
  );
  if (waMatch) {
    const number = waMatch[1].replace(/\s+/g, "");
    const message = encodeURIComponent(waMatch[2].trim());
    return {
      action: `Sending your message. Let's hope they reply, Prithviraj Shetty.`,
      url: `https://web.whatsapp.com/send?phone=${number}&text=${message}`,
      isBrowserAction: true,
    };
  }

  // Phone call: "Call [number]" or "Call [name]"
  const callMatch = lowerCmd.match(/^call\s+(.+)$/);
  if (callMatch) {
    const target = callMatch[1].trim();
    // If it contains mostly digits, it's a number
    const numberMatch = target.match(/[\d\+\s\-]{4,}/);
    if (numberMatch) {
      const cleanNumber = numberMatch[0].replace(/[\s\-]/g, "");
      return {
        action: `Dialing ${cleanNumber}... Let's see if they answer.`,
        url: `tel:${cleanNumber}`,
        isBrowserAction: true,
      };
    } else {
      if (Capacitor.isNativePlatform()) {
        try {
          let permStatus = await Contacts.checkPermissions();
          if (permStatus.contacts !== 'granted') {
            permStatus = await Contacts.requestPermissions();
          }
          if (permStatus.contacts === 'granted') {
            const result = await Contacts.getContacts({ projection: { name: true, phones: true } });
            const found = result.contacts.find(c => {
              const nameStr = [c.name?.given, c.name?.middle, c.name?.family].map(n => n || "").join(" ").toLowerCase();
              return nameStr.includes(target) || (c.name?.display && c.name?.display.toLowerCase().includes(target));
            });
            
            if (found && found.phones && found.phones.length > 0) {
              const numberToCall = found.phones[0].number;
              const displayName = found.name?.display || target;
              return {
                 action: `Calling ${displayName}... Let's see if they pick up.`,
                 url: `tel:${numberToCall}`,
                 isBrowserAction: true
              };
            } else {
              return { action: `I couldn't find a contact named ${target}.`, isBrowserAction: true };
            }
          } else {
             return { action: "Please allow contact permissions so I can call them.", isBrowserAction: true };
          }
        } catch (e) {
          return { action: `Oops, I encountered an error while accessing your contacts.`, isBrowserAction: true };
        }
      } else {
        return {
          action: `I can't access your mobile contacts from the web! Try calling their number directly like "Call 9876543210".`,
          isBrowserAction: true,
        };
      }
    }
  }

  // Maps/Directions: "Directions from [place1] to [place2]"
  const directionsMatch = lowerCmd.match(/^(?:get\s+)?directions\s+(?:from\s+)?(.+?)\s+to\s+(.+)$/);
  if (directionsMatch) {
    return {
      action: `Showing directions from ${directionsMatch[1]} to ${directionsMatch[2]}. Don't get lost!`,
      url: `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(directionsMatch[1])}&destination=${encodeURIComponent(directionsMatch[2])}`,
      isBrowserAction: true,
      mapData: { origin: directionsMatch[1], destination: directionsMatch[2] }
    };
  }

  // Simple location search: "Directions to [destination]"
  const simpleDirectionsMatch = lowerCmd.match(/^(?:get\s+)?directions\s+to\s+(.+)$/);
  if (simpleDirectionsMatch) {
    return {
      action: `Opening directions to ${simpleDirectionsMatch[1]} for you.`,
      url: `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(simpleDirectionsMatch[1])}`,
      isBrowserAction: true,
      mapData: { destination: simpleDirectionsMatch[1] }
    };
  }

  return { action: "", isBrowserAction: false };
}
