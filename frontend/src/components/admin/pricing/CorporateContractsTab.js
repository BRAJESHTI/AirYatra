import React from 'react';
import { Building2, Plus, Calendar, Percent, Trash2 } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

/**
 * Corporate Contracts Tab Component
 * Handles corporate contract pricing configuration
 */
export const CorporateContractsTab = ({ 
  contracts, 
  newContract, 
  setNewContract, 
  addContract, 
  saving 
}) => {
  return (
    <Card className="bg-slate-800/50 border-slate-700">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <Building2 className="h-5 w-5 text-purple-500" />
          Corporate Contracts / कॉर्पोरेट अनुबंध
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add New Contract */}
        <div className="bg-slate-700/30 rounded-lg p-4">
          <h4 className="text-white font-medium mb-3">Add New Contract / नया अनुबंध जोड़ें</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <Label className="text-slate-400 text-sm">Contract ID</Label>
              <Input
                type="text"
                value={newContract.contract_id}
                onChange={(e) => setNewContract(prev => ({ ...prev, contract_id: e.target.value }))}
                placeholder="CORP-001"
                className="bg-slate-700 border-slate-600 text-white mt-1"
              />
            </div>
            <div>
              <Label className="text-slate-400 text-sm">Company Name</Label>
              <Input
                type="text"
                value={newContract.company_name}
                onChange={(e) => setNewContract(prev => ({ ...prev, company_name: e.target.value }))}
                placeholder="Tata Group"
                className="bg-slate-700 border-slate-600 text-white mt-1"
              />
            </div>
            <div>
              <Label className="text-slate-400 text-sm">Contract Type</Label>
              <select
                value={newContract.contract_type}
                onChange={(e) => setNewContract(prev => ({ ...prev, contract_type: e.target.value }))}
                className="w-full bg-slate-700 border-slate-600 text-white rounded-md p-2 mt-1 h-10"
              >
                <option value="corporate">Corporate</option>
                <option value="government">Government</option>
                <option value="medical">Medical/Hospital</option>
                <option value="media">Media/Film</option>
                <option value="political">Political</option>
              </select>
            </div>
            <div>
              <Label className="text-slate-400 text-sm">Discount (%)</Label>
              <Input
                type="number"
                value={newContract.discount_percent}
                onChange={(e) => setNewContract(prev => ({ ...prev, discount_percent: parseFloat(e.target.value) || 0 }))}
                className="bg-slate-700 border-slate-600 text-white mt-1"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
            <div>
              <Label className="text-slate-400 text-sm">Fixed Rate/Hour (₹, optional)</Label>
              <Input
                type="number"
                value={newContract.fixed_rate_per_hour || ''}
                onChange={(e) => setNewContract(prev => ({ ...prev, fixed_rate_per_hour: e.target.value ? parseFloat(e.target.value) : null }))}
                placeholder="Leave blank for %"
                className="bg-slate-700 border-slate-600 text-white mt-1"
              />
            </div>
            <div>
              <Label className="text-slate-400 text-sm">Valid From</Label>
              <Input
                type="date"
                value={newContract.valid_from}
                onChange={(e) => setNewContract(prev => ({ ...prev, valid_from: e.target.value }))}
                className="bg-slate-700 border-slate-600 text-white mt-1"
              />
            </div>
            <div>
              <Label className="text-slate-400 text-sm">Valid To</Label>
              <Input
                type="date"
                value={newContract.valid_to}
                onChange={(e) => setNewContract(prev => ({ ...prev, valid_to: e.target.value }))}
                className="bg-slate-700 border-slate-600 text-white mt-1"
              />
            </div>
            <div className="flex items-end">
              <Button onClick={addContract} disabled={saving} className="bg-purple-600 hover:bg-purple-700 w-full">
                <Plus className="h-4 w-4 mr-1" /> Add Contract
              </Button>
            </div>
          </div>
        </div>

        {/* Existing Contracts */}
        <div className="space-y-2">
          <h4 className="text-white font-medium">Active Contracts ({contracts.length})</h4>
          {contracts.length === 0 ? (
            <p className="text-slate-400 text-sm">No corporate contracts configured yet.</p>
          ) : (
            <div className="space-y-2">
              {contracts.map((contract, index) => (
                <div 
                  key={index}
                  className="bg-slate-700/30 rounded-lg p-4 flex items-center justify-between"
                >
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 bg-purple-500/20 rounded-lg flex items-center justify-center">
                      <Building2 className="h-6 w-6 text-purple-400" />
                    </div>
                    <div>
                      <p className="text-white font-medium">{contract.company_name}</p>
                      <p className="text-slate-400 text-sm">
                        ID: {contract.contract_id} • Type: {contract.contract_type}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      {contract.discount_percent > 0 && (
                        <Badge className="bg-green-500/20 text-green-400">
                          <Percent className="h-3 w-3 mr-1" />
                          {contract.discount_percent}% discount
                        </Badge>
                      )}
                      {contract.fixed_rate_per_hour && (
                        <p className="text-slate-400 text-xs mt-1">
                          Fixed: ₹{contract.fixed_rate_per_hour.toLocaleString()}/hr
                        </p>
                      )}
                    </div>
                    <div className="text-right text-xs text-slate-500">
                      <p className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {contract.valid_from || 'N/A'}
                      </p>
                      <p>to {contract.valid_to || 'N/A'}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default CorporateContractsTab;
