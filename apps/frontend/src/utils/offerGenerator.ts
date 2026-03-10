export const generatePersonalOfferLink = (
    baseUrl: string,
    leadId: string,
    discount: number,
    initialPayment?: number | null,
    selectedIds?: string[] | null
): string => {
    const params = new URLSearchParams();
    params.set('uuid', leadId);
    params.set('offerDiscount', discount.toString());

    if (initialPayment !== undefined && initialPayment !== null && !isNaN(initialPayment)) {
        params.set('initialPayment', initialPayment.toString());
    }

    if (selectedIds && selectedIds.length > 0) {
        params.set('selectedIds', selectedIds.join(','));
    }

    // Encode to Base64URL
    const encoded = btoa(params.toString())
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

    // Format baseUrl properly
    const sanitizedBaseUrl = baseUrl.replace(/\/$/, ''); // Remove trailing slash
    return `${sanitizedBaseUrl}/?offer=${encoded}`;
};
