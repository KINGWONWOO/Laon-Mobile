import Purchases, { LOG_LEVEL, PurchasesPackage, CustomerInfo } from 'react-native-purchases';
import { Platform } from 'react-native';

const RC_API_KEY_IOS = 'appl_AaNtdLiUvRWPUawaYrTsFRNcgTG';
const RC_API_KEY_ANDROID = 'goog_MbFvKeqoLyAtmbGINoNCApsoRWW';

export const ENTITLEMENT_PRO = 'pro';

export const initRevenueCat = (userId: string) => {
  const apiKey = Platform.OS === 'ios' ? RC_API_KEY_IOS : RC_API_KEY_ANDROID;
  if (__DEV__) Purchases.setLogLevel(LOG_LEVEL.DEBUG);
  Purchases.configure({ apiKey, appUserID: userId });
};

export const getOfferings = async () => {
  const offerings = await Purchases.getOfferings();
  return offerings.current;
};

export const purchasePackage = async (pkg: PurchasesPackage): Promise<CustomerInfo> => {
  const { customerInfo } = await Purchases.purchasePackage(pkg);
  return customerInfo;
};

export const getCustomerInfo = async (): Promise<CustomerInfo> => {
  return await Purchases.getCustomerInfo();
};

export const restorePurchases = async (): Promise<CustomerInfo> => {
  return await Purchases.restorePurchases();
};

export const isProActive = (customerInfo: CustomerInfo): boolean => {
  return customerInfo.entitlements.active[ENTITLEMENT_PRO] !== undefined;
};

export const getProExpiryMs = (customerInfo: CustomerInfo): number | null => {
  const entitlement = customerInfo.entitlements.active[ENTITLEMENT_PRO];
  if (!entitlement?.expirationDate) return null;
  return new Date(entitlement.expirationDate).getTime();
};
