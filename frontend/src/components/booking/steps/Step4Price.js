import React from 'react';
import {
  Briefcase, Calculator, Building2, AlertCircle, Check, Gift, Tag,
  FileText, Scale, AlertTriangle, PenTool, ExternalLink, Send, Search,
  User, Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import PriceLockTimer from '../PriceLockTimer';
import { bookingTypes, aircraftTypes } from '../bookingConfig';
import { pricingEngineAPI } from '../../../services/api';

/**
 * Step 4: Booking Summary + Price Breakdown + Referral/Wallet + Consents + Search/Inquiry.
 * Split from BookingPage.js for maintainability.
 */
const Step4Price = ({
  formData,
  handleInputChange,
  distanceKm,
  priceEstimate,
  permissionRequired,
  priceLock,
  setPriceLock,
  referralCode,
  setReferralCode,
  referralApplied,
  applyReferral,
  discountCode,
  setDiscountCode,
  discountApplied,
  applyDiscount,
  applyingCode,
  walletBalance,
  useWallet,
  setUseWallet,
  getFinalPrice,
  consents,
  toggleConsent,
  allConsentsAccepted,
  handleMarketplaceSearch,
  handleSubmitInquiry,
  submitting,
  t,
}) => (
  <div className="space-y-6">
    {/* Price Lock Timer */}
    {priceLock.isLocked && (
      <PriceLockTimer
        lockId={priceLock.lockId}
        expiresAt={priceLock.expiresAt}
        totalAmount={priceLock.lockedAmount}
        onExpire={() => {
          setPriceLock({ isLocked: false, lockId: null, expiresAt: null, lockedAmount: null });
          toast.warning('Price lock expired. Please recalculate for latest pricing.');
        }}
        onExtend={async () => {
          try {
            const response = await pricingEngineAPI.extendPriceLock(priceLock.lockId);
            if (response.data?.expires_at) {
              setPriceLock((prev) => ({ ...prev, expiresAt: response.data.expires_at }));
            }
          } catch (error) {
            console.error('Failed to extend price lock:', error);
          }
        }}
        redirectOnExpire="/booking"
      />
    )}

    {/* Summary Card */}
    <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
      <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
        <Briefcase className="h-5 w-5 text-orange-400" />
        {t('bookingForm.bookingSummary')}
      </h3>

      <div className="grid grid-cols-2 gap-4 text-sm">
        <div className="text-slate-400">Booking Type</div>
        <div className="text-white">
          {bookingTypes.find((b) => b.value === formData.booking_type)?.icon || '→'}{' '}
          {bookingTypes.find((b) => b.value === formData.booking_type)?.label || formData.booking_type}
        </div>

        <div className="text-slate-400">Service</div>
        <div className="text-white">
          {aircraftTypes.find((a) => a.value === formData.aircraft_type)?.icon || '🚁'}{' '}
          {aircraftTypes.find((a) => a.value === formData.aircraft_type)?.label || formData.aircraft_type}
        </div>

        <div className="text-slate-400">{t('bookingForm.totalPassengersLabel')}</div>
        <div className="text-white">{formData.total_passengers} {t('bookingForm.adults')} + {formData.children_count} {t('bookingForm.childrenLabel')}</div>

        <div className="text-slate-400">{t('bookingForm.flightTypeLabel')}</div>
        <div className="text-white">{formData.udan_prakar ? t(`options.${formData.udan_prakar}`) : '-'}</div>

        <div className="text-slate-400">{t('bookingForm.pickupLabel')}</div>
        <div className="text-white">
          {formData.pickup_landing_point?.landing_point_name || formData.pickup_location}
          {formData.pickup_landing_point?.landing_point_type && (
            <span className="ml-2 text-xs px-2 py-0.5 bg-slate-700 rounded">
              {formData.pickup_landing_point.landing_point_type.replace('_', ' ')}
            </span>
          )}
        </div>

        <div className="text-slate-400">{t('bookingForm.dropLabel')}</div>
        <div className="text-white">
          {formData.drop_landing_point?.landing_point_name || formData.drop_location}
          {formData.drop_landing_point?.landing_point_type && (
            <span className="ml-2 text-xs px-2 py-0.5 bg-slate-700 rounded">
              {formData.drop_landing_point.landing_point_type.replace('_', ' ')}
            </span>
          )}
        </div>

        <div className="text-slate-400">{t('bookingForm.distanceLabel')}</div>
        <div className="text-orange-400 font-bold">{distanceKm} KM</div>

        <div className="text-slate-400">{t('bookingForm.dateTimeLabel')}</div>
        <div className="text-white">{formData.departure_date} {t('bookingForm.at')} {formData.pickup_time}</div>
      </div>
    </div>

    {/* Permission Required Warning */}
    {permissionRequired && (
      <div className="bg-yellow-500/10 rounded-xl p-4 border border-yellow-500/30">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-6 w-6 text-yellow-400 shrink-0" />
          <div>
            <h4 className="text-yellow-400 font-semibold">⚠️ {t('bookingForm.villageApprovalTitle')}</h4>
            <p className="text-yellow-400/70 text-sm mt-1">
              {t('bookingForm.villageApprovalDesc')}
            </p>
          </div>
        </div>
      </div>
    )}

    {/* Price Breakdown */}
    {priceEstimate && (
      <div className="bg-gradient-to-br from-orange-500/10 to-amber-500/10 rounded-xl p-6 border border-orange-500/30">
        <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
          <Calculator className="h-5 w-5 text-orange-400" />
          {t('bookingForm.priceBreakdown')}
          {priceEstimate.calculation_id && (
            <span className="text-xs text-slate-500 ml-auto">ID: {priceEstimate.calculation_id}</span>
          )}
        </h3>

        <div className="space-y-2 text-sm">
          {/* Base Charges Section */}
          <div className="bg-slate-800/50 rounded-lg p-3 mb-3">
            <p className="text-orange-400 font-semibold mb-2 text-xs uppercase tracking-wide">{t('bookingForm.baseFlightCost')}</p>
            <div className="space-y-1">
              <div className="flex justify-between text-slate-300">
                <span>{t('bookingForm.flightCost')} ({distanceKm} km):</span>
                <span>₹{(priceEstimate.base_flight_cost || priceEstimate.base_price || 0).toLocaleString()}</span>
              </div>
              {priceEstimate.dead_leg_cost > 0 && (
                <div className="flex justify-between text-slate-300">
                  <span>{t('bookingForm.positioningCost')}:</span>
                  <span>₹{priceEstimate.dead_leg_cost?.toLocaleString()}</span>
                </div>
              )}
              {priceEstimate.mdg_adjustment > 0 && (
                <div className="flex justify-between text-slate-300">
                  <span>Min Guarantee (MDG) Adjustment:</span>
                  <span>₹{priceEstimate.mdg_adjustment?.toLocaleString()}</span>
                </div>
              )}
              {priceEstimate.purpose_adjustment > 0 && (
                <div className="flex justify-between text-amber-400">
                  <span>{priceEstimate.purpose} Multiplier ({priceEstimate.purpose_multiplier}x):</span>
                  <span>+₹{priceEstimate.purpose_adjustment?.toLocaleString()}</span>
                </div>
              )}
              {priceEstimate.round_trip_discount > 0 && (
                <div className="flex justify-between text-green-400">
                  <span>{t('bookingForm.roundTripDiscount')}:</span>
                  <span>-₹{priceEstimate.round_trip_discount?.toLocaleString()}</span>
                </div>
              )}
              <div className="flex justify-between text-slate-200 font-medium pt-1 border-t border-slate-700">
                <span>{t('bookingForm.operatorGrossCost')}:</span>
                <span>₹{(priceEstimate.operator_gross_cost || priceEstimate.base_subtotal || 0).toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* Additional Aviation Charges */}
          {(priceEstimate.waiting_charges > 0 || priceEstimate.night_halt_cost > 0 || priceEstimate.crew_charges > 0) && (
            <div className="bg-slate-800/50 rounded-lg p-3 mb-3">
              <p className="text-yellow-400 font-semibold mb-2 text-xs uppercase tracking-wide">{t('bookingForm.additionalCharges')}</p>
              <div className="space-y-1">
                {priceEstimate.waiting_charges > 0 && (
                  <div className="flex justify-between text-slate-300">
                    <span>{t('bookingForm.waitingGroundHolding')}:</span>
                    <span>₹{priceEstimate.waiting_charges?.toLocaleString()}</span>
                  </div>
                )}
                {priceEstimate.night_halt_cost > 0 && (
                  <div className="flex justify-between text-slate-300">
                    <span>Night Halt ({priceEstimate.night_halts || formData.night_halts} nights):</span>
                    <span>₹{priceEstimate.night_halt_cost?.toLocaleString()}</span>
                  </div>
                )}
                {priceEstimate.crew_charges > 0 && (
                  <div className="flex justify-between text-slate-300">
                    <span>{t('bookingForm.crewAccommodation')}:</span>
                    <span>₹{priceEstimate.crew_charges?.toLocaleString()}</span>
                  </div>
                )}
                {priceEstimate.fuel_surcharge > 0 && (
                  <div className="flex justify-between text-slate-300">
                    <span>{t('bookingForm.fuelSurcharge')}:</span>
                    <span>₹{priceEstimate.fuel_surcharge?.toLocaleString()}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Platform Fees & Charges */}
          <div className="bg-slate-800/50 rounded-lg p-3 mb-3">
            <p className="text-blue-400 font-semibold mb-2 text-xs uppercase tracking-wide">{t('bookingForm.platformFees')}</p>
            <div className="space-y-1">
              <div className="flex justify-between text-slate-300">
                <span>{t('bookingForm.convenienceFee')} ({priceEstimate.convenience_fee_percent || 5}%):</span>
                <span>₹{(priceEstimate.convenience_fee || 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>{t('bookingForm.insurance')} ({priceEstimate.insurance_percent || 2}%):</span>
                <span>₹{(priceEstimate.insurance || 0).toLocaleString()}</span>
              </div>
              {priceEstimate.peak_surge_applied && (
                <div className="flex justify-between text-red-400">
                  <span>{t('bookingForm.peakSurge')} ({priceEstimate.peak_surge_multiplier}x):</span>
                  <span>+₹{priceEstimate.peak_surge_amount?.toLocaleString()}</span>
                </div>
              )}
              <div className="flex justify-between text-slate-400 text-xs">
                <span>Platform Commission ({priceEstimate.platform_commission_percent || priceEstimate.commission_percent || 10}%):</span>
                <span className="text-slate-500">Included</span>
              </div>
            </div>
          </div>

          {/* Helipad Landing Charges */}
          {priceEstimate.total_landing_charges > 0 && (
            <div className="bg-slate-800/50 rounded-lg p-3 mb-3">
              <p className="text-green-400 font-semibold mb-2 text-xs uppercase tracking-wide flex items-center gap-1">
                <Building2 className="h-3 w-3" />
                {t('bookingForm.helipadCharges')}
              </p>
              <div className="space-y-1">
                {priceEstimate.pickup_landing_charge > 0 && (
                  <div className="flex justify-between text-slate-300">
                    <span>Pickup {priceEstimate.pickup_landing_name ? `- ${priceEstimate.pickup_landing_name}` : ''}:</span>
                    <span>₹{priceEstimate.pickup_landing_charge?.toLocaleString()}</span>
                  </div>
                )}
                {priceEstimate.drop_landing_charge > 0 && (
                  <div className="flex justify-between text-slate-300">
                    <span>Drop {priceEstimate.drop_landing_name ? `- ${priceEstimate.drop_landing_name}` : ''}:</span>
                    <span>₹{priceEstimate.drop_landing_charge?.toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between text-slate-200 font-medium pt-1 border-t border-slate-700">
                  <span>{t('bookingForm.totalLandingCharges')}:</span>
                  <span>₹{priceEstimate.total_landing_charges?.toLocaleString()}</span>
                </div>
              </div>
            </div>
          )}

          {/* GST Breakdown */}
          <div className="bg-slate-800/50 rounded-lg p-3 mb-3">
            <p className="text-purple-400 font-semibold mb-2 text-xs uppercase tracking-wide">
              GST ({priceEstimate.gst_type === 'inter_state' ? 'IGST' : 'CGST+SGST'})
            </p>
            <div className="space-y-1">
              <div className="flex justify-between text-slate-400 text-xs">
                <span>{t('bookingForm.taxableAmount')}:</span>
                <span>₹{(priceEstimate.taxable_amount || priceEstimate.subtotal_before_gst || 0).toLocaleString()}</span>
              </div>
              {priceEstimate.gst_type === 'inter_state' ? (
                <div className="flex justify-between text-slate-300">
                  <span>IGST ({priceEstimate.igst_percent || 18}%):</span>
                  <span>₹{(priceEstimate.igst || 0).toLocaleString()}</span>
                </div>
              ) : (
                <>
                  <div className="flex justify-between text-slate-300">
                    <span>CGST ({priceEstimate.cgst_percent || 9}%):</span>
                    <span>₹{(priceEstimate.cgst || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span>SGST ({priceEstimate.sgst_percent || 9}%):</span>
                    <span>₹{(priceEstimate.sgst || 0).toLocaleString()}</span>
                  </div>
                </>
              )}
              <div className="flex justify-between text-slate-200 font-medium pt-1 border-t border-slate-700">
                <span>{t('bookingForm.totalGst')}:</span>
                <span>₹{(priceEstimate.total_gst || priceEstimate.gst || 0).toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* Grand Total */}
          <div className="bg-gradient-to-r from-orange-500/20 to-amber-500/20 rounded-lg p-4 border border-orange-500/40">
            <div className="flex justify-between items-center">
              <div>
                <span className="text-white font-bold text-lg">{t('bookingForm.grandTotal')}</span>
                <span className="text-slate-400 text-xs block">({t('bookingForm.inclusiveTaxes')})</span>
              </div>
              <span className="text-orange-400 font-bold text-2xl" data-testid="grand-total-amount">₹{(priceEstimate.total || 0).toLocaleString()}</span>
            </div>
            {priceEstimate.operator_payout > 0 && (
              <div className="mt-2 pt-2 border-t border-orange-500/30 flex justify-between text-xs text-slate-400">
                <span>{t('bookingForm.operatorReceives')}:</span>
                <span>₹{priceEstimate.operator_payout?.toLocaleString()}</span>
              </div>
            )}
          </div>

          {/* Referral & Discount Section */}
          <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700 mt-4">
            <h4 className="text-white font-semibold mb-3 flex items-center gap-2">
              <Gift className="h-4 w-4 text-green-400" />
              Referral & Discounts
            </h4>

            {/* Referral Code Input */}
            {!referralApplied && (
              <div className="mb-3">
                <Label className="text-slate-400 text-sm mb-1 block">Referral Code (Friend&apos;s Code)</Label>
                <div className="flex gap-2">
                  <Input
                    value={referralCode}
                    onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                    placeholder="AIRXXX"
                    className="bg-slate-900 border-slate-600 text-white uppercase"
                    disabled={applyingCode}
                    data-testid="referral-code-input"
                  />
                  <Button
                    onClick={applyReferral}
                    disabled={applyingCode || !referralCode.trim()}
                    className="bg-green-600 hover:bg-green-700"
                    data-testid="apply-referral-btn"
                  >
                    {applyingCode ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Apply'}
                  </Button>
                </div>
                <p className="text-slate-500 text-xs mt-1">Get 10% off on your first booking!</p>
              </div>
            )}

            {/* Referral Applied Badge */}
            {referralApplied && (
              <div className="mb-3 p-3 bg-green-500/10 rounded-lg border border-green-500/30">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-400" />
                    <span className="text-green-400">Referral Applied!</span>
                  </div>
                  <span className="text-green-400 font-bold">-{referralApplied.discount_percent}%</span>
                </div>
                <p className="text-slate-400 text-xs mt-1">Referred by: {referralApplied.referrer_name}</p>
              </div>
            )}

            {/* Discount Code Input */}
            {!discountApplied && (
              <div className="mb-3">
                <Label className="text-slate-400 text-sm mb-1 block">Promo Code</Label>
                <div className="flex gap-2">
                  <Input
                    value={discountCode}
                    onChange={(e) => setDiscountCode(e.target.value.toUpperCase())}
                    placeholder="AIRYATRA10"
                    className="bg-slate-900 border-slate-600 text-white uppercase"
                    disabled={applyingCode}
                    data-testid="discount-code-input"
                  />
                  <Button
                    onClick={applyDiscount}
                    disabled={applyingCode || !discountCode.trim()}
                    variant="outline"
                    className="border-slate-600"
                    data-testid="apply-discount-btn"
                  >
                    {applyingCode ? <Loader2 className="h-4 w-4 animate-spin" /> : <Tag className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            )}

            {/* Discount Applied Badge */}
            {discountApplied && (
              <div className="mb-3 p-3 bg-purple-500/10 rounded-lg border border-purple-500/30">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Tag className="h-4 w-4 text-purple-400" />
                    <span className="text-purple-400">{discountApplied.code} Applied!</span>
                  </div>
                  <span className="text-purple-400 font-bold">-₹{discountApplied.discount_amount?.toLocaleString()}</span>
                </div>
              </div>
            )}

            {/* Wallet Balance */}
            {walletBalance > 0 && (
              <div className="p-3 bg-blue-500/10 rounded-lg border border-blue-500/30">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="use-wallet"
                      checked={useWallet}
                      onCheckedChange={setUseWallet}
                      data-testid="use-wallet-checkbox"
                    />
                    <label htmlFor="use-wallet" className="text-white cursor-pointer">
                      Use Wallet Balance
                    </label>
                  </div>
                  <span className="text-blue-400 font-bold">₹{walletBalance.toLocaleString()}</span>
                </div>
              </div>
            )}
          </div>

          {/* Final Price After Discounts */}
          {(referralApplied || discountApplied || (useWallet && walletBalance > 0)) && (
            <div className="bg-gradient-to-r from-green-500/20 to-emerald-500/20 rounded-lg p-4 border border-green-500/40 mt-2">
              <div className="space-y-2">
                <div className="flex justify-between text-slate-400">
                  <span>Original Price:</span>
                  <span className="line-through">₹{(priceEstimate.total || 0).toLocaleString()}</span>
                </div>
                {getFinalPrice().discounts.map((d, i) => (
                  <div key={i} className="flex justify-between text-green-400">
                    <span>{d.type}:</span>
                    <span>-₹{d.amount.toLocaleString()}</span>
                  </div>
                ))}
                <div className="flex justify-between items-center pt-2 border-t border-green-500/30">
                  <span className="text-white font-bold text-lg">You Pay:</span>
                  <span className="text-green-400 font-bold text-2xl" data-testid="final-payable-amount">₹{getFinalPrice().total.toLocaleString()}</span>
                </div>
              </div>
            </div>
          )}

          {/* Notes */}
          {priceEstimate.notes && priceEstimate.notes.length > 0 && (
            <div className="text-xs text-amber-400 mt-2">
              {priceEstimate.notes.map((note, i) => (
                <p key={i} className="flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" /> {note}
                </p>
              ))}
            </div>
          )}
        </div>

        <p className={`text-sm mt-4 flex items-center gap-2 ${permissionRequired ? 'text-yellow-400' : 'text-amber-400'}`}>
          <AlertCircle className="h-4 w-4" />
          {priceEstimate.note}
        </p>
      </div>
    )}

    {/* Special Requirements */}
    <div>
      <Label className="text-white mb-2 block">
        {t('bookingForm.specialRequirements')}
      </Label>
      <textarea
        value={formData.special_requirements}
        onChange={(e) => handleInputChange('special_requirements', e.target.value)}
        placeholder={t('bookingForm.specialRequirementsPlaceholder')}
        className="w-full h-24 bg-slate-800 border border-slate-600 rounded-lg p-3 text-white placeholder-slate-500"
        data-testid="special-requirements-textarea"
      />
    </div>

    {/* =============== MANDATORY LEGAL CONSENTS =============== */}
    <div className="bg-slate-800/50 rounded-xl p-5 border border-amber-500/30 mt-6">
      <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
        <Scale className="h-5 w-5 text-amber-400" />
        Mandatory Consents
        <span className="text-red-500 text-sm ml-auto">* Required</span>
      </h3>

      <div className="space-y-4">
        {/* Consent 1: Terms & Conditions */}
        <div
          className={`p-3 rounded-lg border cursor-pointer transition-all ${
            consents.terms_conditions
              ? 'bg-green-500/10 border-green-500/50'
              : 'bg-slate-900/50 border-slate-700 hover:border-amber-500/50'
          }`}
          onClick={() => toggleConsent('terms_conditions')}
        >
          <div className="flex items-start gap-3">
            <Checkbox
              id="consent-terms"
              checked={consents.terms_conditions}
              onCheckedChange={() => toggleConsent('terms_conditions')}
              className="mt-1 data-[state=checked]:bg-green-500 data-[state=checked]:border-green-500"
              data-testid="consent-terms-checkbox"
            />
            <div className="flex-1">
              <label htmlFor="consent-terms" className="text-white text-sm font-medium cursor-pointer">
                <FileText className="h-4 w-4 inline mr-2 text-amber-400" />
                Terms & Conditions
              </label>
              <p className="text-slate-400 text-xs mt-1">
                I confirm that I have carefully read and understood the AirYatra{' '}
                <a href="/legal/terms" target="_blank" rel="noopener noreferrer" className="text-orange-400 underline hover:text-orange-300" onClick={(e) => e.stopPropagation()}>
                  Terms & Conditions <ExternalLink className="h-3 w-3 inline" />
                </a>, {' '}
                <a href="/legal/privacy" target="_blank" rel="noopener noreferrer" className="text-orange-400 underline hover:text-orange-300" onClick={(e) => e.stopPropagation()}>
                  Privacy Policy <ExternalLink className="h-3 w-3 inline" />
                </a>, and {' '}
                <a href="/legal/cancellation" target="_blank" rel="noopener noreferrer" className="text-orange-400 underline hover:text-orange-300" onClick={(e) => e.stopPropagation()}>
                  Cancellation Policy <ExternalLink className="h-3 w-3 inline" />
                </a>.
              </p>
            </div>
          </div>
        </div>

        {/* Consent 2: Flight Conditions */}
        <div
          className={`p-3 rounded-lg border cursor-pointer transition-all ${
            consents.flight_conditions
              ? 'bg-green-500/10 border-green-500/50'
              : 'bg-slate-900/50 border-slate-700 hover:border-amber-500/50'
          }`}
          onClick={() => toggleConsent('flight_conditions')}
        >
          <div className="flex items-start gap-3">
            <Checkbox
              id="consent-flight"
              checked={consents.flight_conditions}
              onCheckedChange={() => toggleConsent('flight_conditions')}
              className="mt-1 data-[state=checked]:bg-green-500 data-[state=checked]:border-green-500"
              data-testid="consent-flight-checkbox"
            />
            <div className="flex-1">
              <label htmlFor="consent-flight" className="text-white text-sm font-medium cursor-pointer">
                <AlertTriangle className="h-4 w-4 inline mr-2 text-yellow-400" />
                Operator & Flight Conditions
              </label>
              <p className="text-slate-400 text-xs mt-1">
                I understand that helicopter and charter flights are subject to weather conditions, DGCA regulations, operational safety, aircraft availability and applicable government permissions.
              </p>
            </div>
          </div>
        </div>

        {/* Consent 3: Platform Role */}
        <div
          className={`p-3 rounded-lg border cursor-pointer transition-all ${
            consents.platform_role
              ? 'bg-green-500/10 border-green-500/50'
              : 'bg-slate-900/50 border-slate-700 hover:border-amber-500/50'
          }`}
          onClick={() => toggleConsent('platform_role')}
        >
          <div className="flex items-start gap-3">
            <Checkbox
              id="consent-platform"
              checked={consents.platform_role}
              onCheckedChange={() => toggleConsent('platform_role')}
              className="mt-1 data-[state=checked]:bg-green-500 data-[state=checked]:border-green-500"
              data-testid="consent-platform-checkbox"
            />
            <div className="flex-1">
              <label htmlFor="consent-platform" className="text-white text-sm font-medium cursor-pointer">
                <Building2 className="h-4 w-4 inline mr-2 text-blue-400" />
                Platform Role
              </label>
              <p className="text-slate-400 text-xs mt-1">
                I understand that AirYatra operates as an online aviation marketplace and technology platform connecting customers with verified operators unless specifically stated otherwise.
              </p>
            </div>
          </div>
        </div>

        {/* Consent 4: Passenger Information */}
        <div
          className={`p-3 rounded-lg border cursor-pointer transition-all ${
            consents.passenger_info
              ? 'bg-green-500/10 border-green-500/50'
              : 'bg-slate-900/50 border-slate-700 hover:border-amber-500/50'
          }`}
          onClick={() => toggleConsent('passenger_info')}
        >
          <div className="flex items-start gap-3">
            <Checkbox
              id="consent-info"
              checked={consents.passenger_info}
              onCheckedChange={() => toggleConsent('passenger_info')}
              className="mt-1 data-[state=checked]:bg-green-500 data-[state=checked]:border-green-500"
              data-testid="consent-info-checkbox"
            />
            <div className="flex-1">
              <label htmlFor="consent-info" className="text-white text-sm font-medium cursor-pointer">
                <User className="h-4 w-4 inline mr-2 text-green-400" />
                Information Accuracy
              </label>
              <p className="text-slate-400 text-xs mt-1">
                I confirm that all passenger information, travel details and documents provided by me are true and accurate.
              </p>
            </div>
          </div>
        </div>

        {/* Consent 5: Electronic/E-Signature */}
        <div
          className={`p-3 rounded-lg border cursor-pointer transition-all ${
            consents.electronic_consent
              ? 'bg-green-500/10 border-green-500/50'
              : 'bg-slate-900/50 border-slate-700 hover:border-amber-500/50'
          }`}
          onClick={() => toggleConsent('electronic_consent')}
        >
          <div className="flex items-start gap-3">
            <Checkbox
              id="consent-esign"
              checked={consents.electronic_consent}
              onCheckedChange={() => toggleConsent('electronic_consent')}
              className="mt-1 data-[state=checked]:bg-green-500 data-[state=checked]:border-green-500"
              data-testid="consent-esign-checkbox"
            />
            <div className="flex-1">
              <label htmlFor="consent-esign" className="text-white text-sm font-medium cursor-pointer">
                <PenTool className="h-4 w-4 inline mr-2 text-purple-400" />
                Electronic Consent
              </label>
              <p className="text-slate-400 text-xs mt-1">
                I consent to electronic records, digital signatures, OTP authentication and online agreements in accordance with applicable Indian laws (IT Act 2000).
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Consent Progress */}
      <div className="mt-4 pt-4 border-t border-slate-700">
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-400">
            Accepted: {Object.values(consents).filter((v) => v).length} / 5
          </span>
          {allConsentsAccepted ? (
            <span className="text-green-400 flex items-center gap-1">
              <Check className="h-4 w-4" /> All Consents Accepted
            </span>
          ) : (
            <span className="text-amber-400 flex items-center gap-1">
              <AlertCircle className="h-4 w-4" /> Please accept all consents
            </span>
          )}
        </div>
      </div>
    </div>
    {/* =============== END MANDATORY CONSENTS =============== */}

    {/* PRIMARY: Instant Marketplace Search & Book */}
    <Button
      onClick={handleMarketplaceSearch}
      disabled={!allConsentsAccepted}
      data-testid="marketplace-search-btn"
      className={`w-full py-6 text-lg ${
        !allConsentsAccepted
          ? 'bg-slate-600 cursor-not-allowed'
          : 'bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 shadow-lg shadow-orange-500/25'
      }`}
    >
      {!allConsentsAccepted ? (
        <>
          <AlertCircle className="h-5 w-5 mr-2" />
          Accept All Consents to Continue
        </>
      ) : (
        <>
          <Search className="h-5 w-5 mr-2" />
          Find Aircraft & Book Instantly
        </>
      )}
    </Button>
    <p className="text-center text-slate-500 text-xs -mt-2">
      Compare all operators with live prices • Instant confirmation • 15-min price lock
    </p>

    {/* SECONDARY: Traditional Inquiry */}
    <Button
      variant="outline"
      onClick={handleSubmitInquiry}
      disabled={submitting || !priceEstimate || !allConsentsAccepted}
      data-testid="submit-inquiry-btn"
      className={`w-full py-5 border-slate-600 text-slate-300 hover:bg-slate-800 ${
        permissionRequired ? 'border-yellow-500/50 text-yellow-400' : ''
      }`}
    >
      {submitting ? (
        <>
          <Loader2 className="h-5 w-5 mr-2 animate-spin" />
          {t('bookingForm.submitting')}
        </>
      ) : (
        <>
          <Send className="h-5 w-5 mr-2" />
          {permissionRequired ? t('bookingForm.submitApproval') : 'Send Traditional Inquiry (operators will quote)'}
        </>
      )}
    </Button>

    <p className="text-center text-slate-400 text-sm">
      {permissionRequired ? t('bookingForm.approvalNote') : t('bookingForm.inquiryNote')}
    </p>
  </div>
);

export default Step4Price;
