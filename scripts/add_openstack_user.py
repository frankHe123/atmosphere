#!/usr/bin/env python
import argparse

from keystoneclient.exceptions import NotFound

from atmosphere import settings

try:
    from authentication.protocol.oauth import is_atmo_user
except ImportError:
    from authentication.protocol.ldap import is_atmo_user

from core.email import send_new_provider_email

from service.accounts.openstack import AccountDriver


    

def main():
    """
    Add a user to openstack.
    """
    parser = argparse.ArgumentParser()
    parser.add_argument('users', type=str, nargs='+')
    args = parser.parse_args()
    driver = AccountDriver()
    success = 0
    for username in args.users:
        print "Adding username... %s" % username
        try:
            if not is_atmo_user(username):
                print "User is not in the atmo-user group.\n"\
                    + "User does not exist in Atmosphere."
                raise Exception("User does not exist in Atmosphere.")
            password = driver.hashpass(username)
            user = driver.get_user(username)
            if not user:
                user = driver.create_user(username, usergroup=True)
                print 'New OStack User - %s Pass - %s' % (user.name, password)
                send_new_provider_email(username, "Openstack")
            else:
                print 'Found OStack User - %s Pass - %s' % (user.name,
                                                            password)
            #ASSERT: User exists on openstack, create an identity for them.
            ident = driver.create_identity(user.name,
                                                     password,
                                                     project_name=username)
            success += 1
            print 'New OStack Identity - %s:%s' % (ident.id, ident)
        except Exception as e:
            print "Problem adding username: %s" % username
            print e
            raise

    print "Total users created:%s/%s" % (success, len(args.users))

if __name__ == "__main__":
    main()
