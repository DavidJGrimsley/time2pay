import { Alert, Platform } from 'react-native';

function showWebAlert(title: string, message: string): boolean {
  if (typeof window === 'undefined' || typeof window.alert !== 'function') {
    return false;
  }

  window.alert(`${title}\n\n${message}`);
  return true;
}

export function showSystemAlert(title: string, message: string): void {
  if (Platform.OS === 'web' && showWebAlert(title, message)) {
    return;
  }

  Alert.alert(title, message);
}

export function showBlockedAlert(message: string): void {
  showSystemAlert('Action blocked', message);
}

export function showValidationAlert(message: string): void {
  showSystemAlert('Check your input', message);
}

export function showActionErrorAlert(message: string): void {
  showSystemAlert('Action failed', message);
}
