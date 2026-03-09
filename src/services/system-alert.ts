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

function showWebConfirm(title: string, message: string): boolean | null {
  if (typeof window === 'undefined' || typeof window.confirm !== 'function') {
    return null;
  }

  return window.confirm(`${title}\n\n${message}`);
}

export async function showSystemConfirm(input: {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
}): Promise<boolean> {
  if (Platform.OS === 'web') {
    const webResult = showWebConfirm(input.title, input.message);
    if (webResult !== null) {
      return webResult;
    }
  }

  return new Promise((resolve) => {
    Alert.alert(
      input.title,
      input.message,
      [
        {
          text: input.cancelLabel ?? 'Cancel',
          style: 'cancel',
          onPress: () => resolve(false),
        },
        {
          text: input.confirmLabel ?? 'Continue',
          style: 'destructive',
          onPress: () => resolve(true),
        },
      ],
      {
        cancelable: true,
        onDismiss: () => resolve(false),
      },
    );
  });
}
