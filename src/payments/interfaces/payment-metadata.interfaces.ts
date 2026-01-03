
export interface NequiMetadata {
    phoneNumber?: string;
}

export interface PSEMetadata {
    userType?: 'PERSON' | 'BUSINESS' | '0' | '1';
    userLegalId?: string;
    userLegalIdType?: 'CC' | 'CE' | 'NIT' | 'PP' | 'TI' | 'DNI';
    financialInstitutionCode?: string;
    paymentDescription?: string;
}

export interface CardMetadata {
    paymentSourceId?: string;
    installments?: number;
}

export type WompiPaymentMethod = 'NEQUI' | 'PSE' | 'CARD';

export type WompiMetadata = NequiMetadata | PSEMetadata | CardMetadata;
