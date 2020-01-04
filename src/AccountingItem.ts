export class AccountingItem {
   id: string;
   amount: number;
   timestamp: number;
   pair: string;
   fees: number;
   exchange: string;
   price: number;
   qty: number;
   credit: boolean; // true = sell, debit/false = buy   
}