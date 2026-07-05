/**
 * LINE Messaging API client
 *
 * Used for sending push notifications directly to debtor LINE accounts.
 * Requires LINE_CHANNEL_ACCESS_TOKEN and LINE_CHANNEL_SECRET.
 */

export interface LinePushMessageResponse {
  message?: string;
  details?: Array<{ message: string; property: string }>;
}

/**
 * ส่งข้อความแจ้งเตือนผ่าน LINE Push Message API
 *
 * @param lineUserId ID ของผู้รับใน LINE
 * @param messageText ข้อความที่ต้องการส่ง
 * @returns สัญญาว่าจะคืนค่า boolean ตามผลการส่ง
 */
export async function sendLinePushMessage(
  lineUserId: string,
  messageText: string
): Promise<{ success: boolean; error?: string }> {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;

  if (!token || token === 'placeholder') {
    console.warn('[LineNotify] LINE_CHANNEL_ACCESS_TOKEN is not configured. Simulating success.');
    return { success: true };
  }

  if (!lineUserId) {
    return { success: false, error: 'lineUserId is required' };
  }

  try {
    const response = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        to: lineUserId,
        messages: [
          {
            type: 'text',
            text: messageText,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorData = (await response.json()) as LinePushMessageResponse;
      const errMsg = errorData.message ?? response.statusText;
      console.error(`[LineNotify] LINE API returned status ${response.status}:`, errorData);
      return {
        success: false,
        error: `LINE API Error (${response.status}): ${errMsg}`,
      };
    }

    console.log(`[LineNotify] Push message sent successfully to ${lineUserId}`);
    return { success: true };
  } catch (error: any) {
    console.error('[LineNotify] Fetch error during sendLinePushMessage:', error);
    return {
      success: false,
      error: error.message ?? 'Unknown fetch error',
    };
  }
}
